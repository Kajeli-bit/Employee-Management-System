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
// clocking in requires).

const BEAT_INTERVAL_MS = 5 * 60 * 1000;

// Guards against a visible-tab ping landing on top of the interval tick.
const MIN_GAP_MS = 45 * 1000;

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

        // Only an open day needs tracking, and only while the tab is visible
        // enough for the browser to hand over a fresh fix.
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

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        beat();
      }
    };

    // Let the dashboard finish loading before the first report.
    const firstBeat = setTimeout(beat, 5000);
    const interval = setInterval(beat, BEAT_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearTimeout(firstBeat);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [getToken]);

  return null;
};

export default AttendanceHeartbeat;
