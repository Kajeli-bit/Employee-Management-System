import { useEffect } from "react";
import axios from "axios";

import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";

// This component lives above all authenticated routes, including the manager's
// personal attendance pages. It refreshes today's attendance and asks the
// server to evaluate automatic clock-out rules once a minute. Location is sent
// only during an open shift and only while the browser can provide a fix.

const BEAT_INTERVAL_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const MIN_GAP_MS = 45 * 1000;
const ATTENDANCE_REFRESH_EVENT = "ems:attendance-refresh";

const permissionState = async () => {
  try {
    if (!navigator.permissions?.query) {
      return "unknown";
    }

    const status = await navigator.permissions.query({ name: "geolocation" });

    return status.state;
  } catch {
    return "unknown";
  }
};

const readPosition = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 2 * 60 * 1000,
      }
    );
  });

const AttendanceHeartbeat = () => {
  const { getToken, user } = useAuth();

  useEffect(() => {
    if (user?.accountType === "super_user") return undefined;
    let cancelled = false;
    let lastBeatAt = 0;
    let refreshInFlight = null;
    let sweepInFlight = null;

    const getHeaders = async () => {
      const token = await getToken();

      return token ? { Authorization: `Bearer ${token}` } : null;
    };

    const emitAttendance = (data) => {
      if (!cancelled && data?.success) {
        window.dispatchEvent(
          new CustomEvent(ATTENDANCE_REFRESH_EVENT, { detail: data })
        );
      }
    };

    const refreshAttendance = async () => {
      if (refreshInFlight) {
        return refreshInFlight;
      }

      refreshInFlight = (async () => {
        try {
          const headers = await getHeaders();

          if (!headers || cancelled) {
            return;
          }

          const { data } = await axios.get(`${API_URL}/api/attendance/today`, {
            headers,
          });

          emitAttendance(data);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.debug(
              "ATTENDANCE REFRESH SKIPPED:",
              error.response?.status || error.message
            );
          }
        } finally {
          refreshInFlight = null;
        }
      })();

      return refreshInFlight;
    };

    const nudgeSweep = async () => {
      if (sweepInFlight) {
        return sweepInFlight;
      }

      sweepInFlight = (async () => {
        try {
          const headers = await getHeaders();

          if (!headers || cancelled) {
            return;
          }

          await axios.post(
            `${API_URL}/api/attendance/sweep`,
            {},
            { headers }
          );

          await refreshAttendance();
        } catch (error) {
          if (import.meta.env.DEV) {
            console.debug(
              "ATTENDANCE SWEEP CHECK SKIPPED:",
              error.response?.status || error.message
            );
          }
        } finally {
          sweepInFlight = null;
        }
      })();

      return sweepInFlight;
    };

    const beat = async () => {
      if (
        cancelled ||
        document.visibilityState !== "visible" ||
        Date.now() - lastBeatAt < MIN_GAP_MS
      ) {
        return;
      }

      lastBeatAt = Date.now();

      try {
        const headers = await getHeaders();

        if (!headers || cancelled) {
          return;
        }

        // Check out first: if the server already closed this shift, still emit
        // the final record to the visible dashboard/register.
        const { data } = await axios.get(`${API_URL}/api/attendance/today`, {
          headers,
        });

        emitAttendance(data);

        if (!data?.record?.checkIn || data.record.checkOut) {
          return;
        }

        const permission = await permissionState();

        if (permission === "denied" || permission === "prompt") {
          return;
        }

        const position = await readPosition();

        if (!position || cancelled) {
          return;
        }

        await axios.post(
          `${API_URL}/api/attendance/heartbeat`,
          position,
          { headers }
        );

        // Heartbeats can also move the automation along. The route is
        // idempotent and only writes when the configured wall-clock rules match.
        await nudgeSweep();
        await refreshAttendance();
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug(
            "ATTENDANCE HEARTBEAT SKIPPED:",
            error.response?.status || error.message
          );
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshAttendance();
        nudgeSweep();
        beat();
      }
    };

    const onAttendanceRefresh = (event) => {
      if (!event.detail) {
        refreshAttendance();
      }
    };

    const initialRefresh = setTimeout(() => {
      refreshAttendance();
      nudgeSweep();
      beat();
    }, 5000);
    const heartbeatInterval = setInterval(beat, BEAT_INTERVAL_MS);
    const sweepInterval = setInterval(nudgeSweep, SWEEP_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener(ATTENDANCE_REFRESH_EVENT, onAttendanceRefresh);

    return () => {
      cancelled = true;
      clearTimeout(initialRefresh);
      clearInterval(heartbeatInterval);
      clearInterval(sweepInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener(ATTENDANCE_REFRESH_EVENT, onAttendanceRefresh);
    };
  }, [getToken, user?.accountType]);

  return null;
};

export default AttendanceHeartbeat;
