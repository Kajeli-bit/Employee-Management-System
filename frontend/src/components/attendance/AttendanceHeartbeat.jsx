import { useEffect } from "react";
import axios from "axios";

import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";

// While a day is open this component reports the device position every few
// minutes. The automatic clock-out rules on the server read those reports, so
// they can close a day that was never clocked out.
//
// A web page can only read a position while it is open and only with the
// employee's permission, so this is deliberately quiet: it never prompts, and
// it does nothing until the employee has already allowed location access (which
// clocking in requires). It also refreshes attendance views after each run of
// the server's sweep, which can have changed today's check-out behind the tab.

const BEAT_INTERVAL_MS = 5 * 60 * 1000;

// Guards against a visible-tab ping landing on top of the interval tick.
const MIN_GAP_MS = 45 * 1000;
const SWEEP_REFRESH_MS = 60 * 1000;
const ATTENDANCE_REFRESH_EVENT = "ems:attendance-refresh";

// The endpoint is authenticated and checks current wall-clock time before
// changing any attendance record. Calling it for different signed-in users is
// safe; this throttle merely avoids sending duplicate requests from one tab.
const SWEEP_NUDGE_MS = 60 * 1000;

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
  const { getToken } = useAuth();

  useEffect(() => {
    let cancelled = false;
    let lastBeatAt = 0;
    let lastSweepNudgeAt = 0;
    let refreshInFlight = null;

    const getHeaders = async () => {
      const token = await getToken();

      return token ? { Authorization: `Bearer ${token}` } : null;
    };

    const refreshAttendanceViews = async () => {
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

          if (!cancelled) {
            window.dispatchEvent(
              new CustomEvent(ATTENDANCE_REFRESH_EVENT, { detail: data })
            );
          }
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

    const beat = async () => {
      if (cancelled) {
        return;
      }

      if (Date.now() - lastBeatAt < MIN_GAP_MS) {
        return;
      }

      lastBeatAt = Date.now();

      try {
        const token = await getToken();

        if (!token || cancelled) {
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        const { data } = await axios.get(
          `${API_URL}/api/attendance/today`,
          { headers }
        );

        // The endpoint may have closed a day since the user last loaded the
        // page. Notify mounted attendance views so their Out/worked fields update.
        window.dispatchEvent(
          new CustomEvent(ATTENDANCE_REFRESH_EVENT, { detail: data })
        );

        // Only an open day needs a location report. Refreshing the views above
        // must still happen after checkout, without another GPS request.
        if (!data?.record?.checkIn || data?.record?.checkOut) {
          return;
        }

        const state = await permissionState();

        // Never trigger a permission prompt from the background, and respect a
        // refusal. "unknown" (Safari) is allowed through: the employee already
        // granted access when clocking in, so the read stays silent.
        if (state === "denied" || state === "prompt") {
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

        // Heartbeat can itself trigger a sweep. Refresh after it finishes so an
        // early-departure close is also reflected without waiting for the next
        // minute's periodic refresh.
        await refreshAttendanceViews();
      } catch (error) {
        // Tracking is best effort; a failed beat must never disturb the page.
        if (import.meta.env.DEV) {
          console.debug(
            "ATTENDANCE HEARTBEAT SKIPPED:",
            error.response?.status || error.message
          );
        }
      }
    };

    const onAttendanceRefresh = (event) => {
      // If a view has just caused its own refresh, reuse the result instead of
      // immediately doing another API request.
      if (event.detail) {
        return;
      }

      refreshAttendanceViews();
    };

    const nudgeSweep = async () => {
      if (
        cancelled ||
        document.visibilityState !== "visible" ||
        Date.now() - lastSweepNudgeAt < SWEEP_NUDGE_MS
      ) {
        return;
      }

      lastSweepNudgeAt = Date.now();

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
        await refreshAttendanceViews();
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug(
            "ATTENDANCE SWEEP CHECK SKIPPED:",
            error.response?.status || error.message
          );
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        beat();
        nudgeSweep();
        refreshAttendanceViews();
      }
    };

    // Let the dashboard finish loading before the first report. A sweep nudge
    // also lets this signed-in tab advance the same server rule when the
    // scheduled GitHub runner is delayed or unavailable.
    const firstBeat = setTimeout(() => {
      beat();
      nudgeSweep();
    }, 5000);
    const interval = setInterval(beat, BEAT_INTERVAL_MS);
    const refreshInterval = setInterval(nudgeSweep, SWEEP_REFRESH_MS);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener(ATTENDANCE_REFRESH_EVENT, onAttendanceRefresh);

    return () => {
      cancelled = true;
      clearTimeout(firstBeat);
      clearInterval(interval);
      clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener(ATTENDANCE_REFRESH_EVENT, onAttendanceRefresh);
    };
  }, [getToken]);

  return null;
};

export default AttendanceHeartbeat;
