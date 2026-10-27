// Automatic clock-out rules.
//
// A browser can only read a device's position while the app is open, so the
// employee app reports its position every few minutes while a day is open
// (POST /api/attendance/heartbeat). These rules read the latest report and
// decide whether a day that was never closed should be closed for the employee.
//
// At or after the scheduled shift end (17:00 in Dar es Salaam by default),
// close only when a fresh location confirms the device is outside the worksite.
// Store the last on-site time as the checkout time, even though automation runs
// after shift end. A device still inside the work area remains open for manual
// clock-out. Leaving before the required scheduled hours makes the worker an
// Absconder. Saturdays use their configured shift; Sundays are non-working.
//
// Field and remote staff, or companies without an active fence, cannot be
// confirmed as having left a worksite and are never auto-closed.

import {
  DEFAULT_TIMEZONE,
  localDateKey,
  localTimeParts,
  timeStringToMinutes,
  zonedTimeToUtc,
} from "./geo.js";

const MINUTE_MS = 60 * 1000;
const REQUIRED_WORK_MINUTES = 9 * 60;

// A fix must be recent and outside the fence when the after-shift sweep runs.
// The app reports every 5 minutes, so allow missed beats up to 15m.
const PRESENCE_TOLERANCE_MINUTES = 15;
const isRecentAt = (at, reference) => {
  if (!at) return false;
  const timestamp = new Date(at).getTime();
  const referenceTime = new Date(reference).getTime();

  return (
    timestamp <= referenceTime &&
    referenceTime - timestamp <= PRESENCE_TOLERANCE_MINUTES * MINUTE_MS
  );
};

const clampMinutes = (minutes) =>
  Math.min(Math.max(Math.round(Number(minutes) || 0), 0), 23 * 60 + 59);

export const clockString = (minutes) => {
  const safe = clampMinutes(minutes);

  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(
    safe % 60
  ).padStart(2, "0")}`;
};

const clockLabel = (date, timeZone) => {
  const { hour, minute } = localTimeParts(date, timeZone);

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

// Resolves company-local shift start/end times for the automatic sweep.
export const resolveAutomationPolicy = (policy = {}) => {
  const timezone = policy.timezone || DEFAULT_TIMEZONE;
  const workEndMinutes = timeStringToMinutes(policy.workEnd, 17 * 60);
  const saturdayWorkEndMinutes = timeStringToMinutes(
    policy.saturdayWorkEnd,
    13 * 60
  );

  const saturdayWorkStart = clockString(
    timeStringToMinutes(policy.saturdayWorkStart, 9 * 60)
  );
  const saturdayWorkEnd = clockString(saturdayWorkEndMinutes);

  return {
    enabled: policy.autoClockOut !== false,
    timezone,
    workEnd: clockString(workEndMinutes),
    saturdayWorkStart,
    saturdayWorkEnd,
    saturdayCloseAt: saturdayWorkEnd,
    requireGeofence: policy.requireGeofence !== false,
  };
};

const isWorkModeFenced = (employee, rules, hasActiveLocations) =>
  rules.requireGeofence &&
  (employee?.workMode || "Office") === "Office" &&
  hasActiveLocations;

const departureTime = ({ lastSeenInsideAt, checkInAt }) => {
  const inside =
    lastSeenInsideAt && lastSeenInsideAt > checkInAt ? lastSeenInsideAt : null;

  return inside || checkInAt;
};

// Returns null when there is nothing to do, otherwise one of:
//   { action: "clock-out", at, outcome, reason }
export const evaluateDay = ({
  record,
  employee,
  policy,
  now = new Date(),
  // Without a fence there is nothing to be outside of, so "away from the
  // office" must never close a day.
  hasActiveLocations = true,
}) => {
  if (!record?.checkIn?.at || record.checkOut?.at) {
    return null;
  }

  const rules = resolveAutomationPolicy(policy);

  if (!rules.enabled) {
    return null;
  }

  const date = record.date || localDateKey(now, rules.timezone);
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const configuredEnd = weekday === 6 ? rules.saturdayCloseAt : rules.workEnd;
  const workEnd =
    timeStringToMinutes(configuredEnd) >= 17 * 60 ? configuredEnd : "17:00";
  const closeAt = zonedTimeToUtc(date, workEnd, rules.timezone);

  if (weekday === 0 || !closeAt) {
    return null;
  }

  const checkInAt = new Date(record.checkIn.at);
  const last = record.lastSeen?.at ? record.lastSeen : null;
  const lastSeenInsideAt = record.lastSeenInsideAt
    ? new Date(record.lastSeenInsideAt)
    : null;
  const fenced = isWorkModeFenced(employee, rules, hasActiveLocations);

  // Do not act before the shift boundary or infer a departure from a stale
  // location report. Each scheduled sweep can close directly once the current
  // device position confirms it remains outside the worksite.
  if (now <= closeAt) {
    return null;
  }

  if (!fenced) {
    return null;
  }

  if (!last || last.withinGeofence !== false) {
    return record.autoClockOut?.scheduledFor
      ? {
          action: "cancel-schedule",
          outcome: "location-not-confirmed-outside",
          reason: "Automatic clock-out canceled because the device is not currently confirmed outside a work location.",
        }
      : null;
  }

  if (!isRecentAt(last.at, now)) {
    return {
      action: "note",
      outcome: "no-location",
      reason: `No recent off-site location was available after ${workEnd}; the day was left open for review.`,
    };
  }

  const checkoutAt = departureTime({ lastSeenInsideAt, checkInAt });
  const reason = `Device was confirmed outside ${
    last.locationName || "the work location"
  } after last being seen on site at ${clockLabel(
    checkoutAt,
    rules.timezone
  )}. Automatic checkout was registered after ${workEnd}.`;

  return {
    action: "clock-out",
    at: checkoutAt,
    outcome: "left-premises",
    reason,
  };
};

// Worked minutes and status for a day the server closes itself, matching what
// a manual clock-out would have recorded.
export const closingSummary = ({ record, at }) => {
  const checkInAt = new Date(record.checkIn.at);
  const workedMinutes = Math.max(
    0,
    Math.round((new Date(at).getTime() - checkInAt.getTime()) / 60000)
  );
  const isEarlyDeparture = workedMinutes < REQUIRED_WORK_MINUTES;
  const status =
    isEarlyDeparture && !record.earlyDepartureApproved
      ? "Absconder"
      : record.status === "Late" && record.lateByMinutes > 0
        ? "Late"
        : "On Time";

  return { workedMinutes, status, earlyDeparture: isEarlyDeparture };
};
