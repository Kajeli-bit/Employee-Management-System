// Automatic clock-out rules.
//
// A browser can only read a device's position while the app is open, so the
// employee app reports its position every few minutes while a day is open
// (POST /api/attendance/heartbeat). These rules read the latest report and
// decide whether a day that was never closed should be closed for the employee.
//
// Three checks run relative to the end of the working day, in the company's
// timezone (17:00 in Dar es Salaam by default):
//
//   15:30  early departure  the device is outside every work location after
//                           this check → the person left, close the day at the
//                           last time they were seen on site.
//   16:45  presence check   the device is still on site → the day will close
//                           itself at 17:00.
//   17:00  auto clock-out   close the days that were confirmed at 16:45.
//
// Field and remote staff work away from the office by definition, so they are
// never closed early for being outside a fence. They are only closed at 17:00,
// and only once their device has reported during the presence check — that is
// the evidence the day was still running.
//
// Every decision returns the time the day should close at, not the time the
// sweep happened to run, so a late sweep still records an honest 17:00.

import {
  DEFAULT_TIMEZONE,
  localDateKey,
  localTimeParts,
  timeStringToMinutes,
  zonedTimeToUtc,
} from "./geo.js";

const MINUTE_MS = 60 * 1000;

// A fix is accepted for the presence check when it is at most this old at the
// check time. The app reports every 5 minutes, so this absorbs a missed beat.
const PRESENCE_TOLERANCE_MINUTES = 15;

// When a device goes from on-site to off-site within this window, the on-site
// reading is the real departure time. A longer gap means the device stopped
// reporting somewhere in between, so only the off-site reading is evidence.
const DEPARTURE_ESTIMATE_MINUTES = 60;

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

// Turns the stored attendance policy into the three check times, so a company
// that finishes at 18:00 gets checks at 16:30, 17:45 and 18:00.
export const resolveAutomationPolicy = (policy = {}) => {
  const timezone = policy.timezone || DEFAULT_TIMEZONE;
  const workEndMinutes = timeStringToMinutes(policy.workEnd, 17 * 60);
  const earlyMinutes = Math.max(
    0,
    Number(policy.earlyDepartureCheckMinutes ?? 90) || 0
  );
  const confirmMinutes = Math.max(
    0,
    Number(policy.autoClockOutConfirmMinutes ?? 15) || 0
  );

  return {
    enabled: policy.autoClockOut !== false,
    timezone,
    workEnd: clockString(workEndMinutes),
    earlyDepartureAt: clockString(workEndMinutes - earlyMinutes),
    confirmAt: clockString(workEndMinutes - confirmMinutes),
    closeAt: clockString(workEndMinutes),
    halfDayMinutes: Number(policy.halfDayMinutes) || 240,
    requireGeofence: policy.requireGeofence !== false,
  };
};

const isWorkModeFenced = (employee, rules, hasActiveLocations) =>
  rules.requireGeofence &&
  (employee?.workMode || "Office") === "Office" &&
  hasActiveLocations;

const departureTime = ({ record, last, lastSeenInsideAt, checkInAt, now }) => {
  const inside =
    lastSeenInsideAt && lastSeenInsideAt > checkInAt ? lastSeenInsideAt : null;
  const observedAt = last ? new Date(last.at) : null;

  const recentInside =
    inside &&
    observedAt &&
    observedAt.getTime() - inside.getTime() <= DEPARTURE_ESTIMATE_MINUTES * MINUTE_MS
      ? inside
      : null;

  const at = recentInside || observedAt || checkInAt;

  if (at < checkInAt) {
    return checkInAt;
  }

  return at > now ? now : at;
};

// Returns null when there is nothing to do, otherwise one of:
//   { action: "clock-out", at, outcome, reason }
//   { action: "schedule", scheduledFor, outcome, reason }
//   { action: "note", outcome, reason }
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
  const earlyAt = zonedTimeToUtc(date, rules.earlyDepartureAt, rules.timezone);
  const confirmAt = zonedTimeToUtc(date, rules.confirmAt, rules.timezone);
  const closeAt = zonedTimeToUtc(date, rules.closeAt, rules.timezone);

  if (!earlyAt || !confirmAt || !closeAt) {
    return null;
  }

  const checkInAt = new Date(record.checkIn.at);
  const last = record.lastSeen?.at ? record.lastSeen : null;
  const lastSeenInsideAt = record.lastSeenInsideAt
    ? new Date(record.lastSeenInsideAt)
    : null;
  const fenced = isWorkModeFenced(employee, rules, hasActiveLocations);
  const scheduledFor = record.autoClockOut?.scheduledFor
    ? new Date(record.autoClockOut.scheduledFor)
    : null;

  // 1 · A day confirmed at the presence check closes at the end of the day.
  if (scheduledFor) {
    if (now < scheduledFor) {
      return null;
    }

    return {
      action: "clock-out",
      at: scheduledFor,
      outcome: "scheduled",
      reason: `Device was on site at the ${rules.confirmAt} check. Closed automatically at ${rules.closeAt}.`,
    };
  }

  // 2 · Left early: the device was seen away from every work location after
  // the first check. Someone who steps out briefly will send an on-site fix
  // again before 16:45 and stay open until the end of the day.
  if (
    fenced &&
    now >= earlyAt &&
    last &&
    new Date(last.at) >= earlyAt &&
    last.withinGeofence === false
  ) {
    return {
      action: "clock-out",
      at: departureTime({
        record,
        last,
        lastSeenInsideAt,
        checkInAt,
        now,
      }),
      outcome: "left-premises",
      reason: `Device was outside ${
        last.locationName || "the work location"
      } at ${clockLabel(last.at, rules.timezone)}. Closed automatically.`,
    };
  }

  if (now < confirmAt) {
    return null;
  }

  // 3 · Presence check. Without a recent fix the system cannot tell whether
  // the person is still at work or simply closed the app, so it does not guess.
  const presenceAt = last ? new Date(last.at) : null;
  const presenceVerified =
    presenceAt &&
    presenceAt >=
      new Date(
        confirmAt.getTime() - PRESENCE_TOLERANCE_MINUTES * MINUTE_MS
      );

  if (!presenceVerified) {
    return {
      action: "note",
      outcome: "no-location",
      reason: `No location arrived from the device around ${rules.confirmAt}, so the day was left open for review.`,
    };
  }

  if (!fenced || last.withinGeofence) {
    return {
      action: "schedule",
      scheduledFor: closeAt,
      outcome: "scheduled",
      reason: `Device on site at the ${rules.confirmAt} check. The day closes automatically at ${rules.closeAt}.`,
    };
  }

  return {
    action: "clock-out",
    at: departureTime({
      record,
      last,
      lastSeenInsideAt,
      checkInAt,
      now,
    }),
    outcome: "left-premises",
    reason: `Device was outside ${
      last.locationName || "the work location"
    } at ${clockLabel(last.at, rules.timezone)}. Closed automatically.`,
  };
};

// Worked minutes and status for a day the server closes itself, matching what
// a manual clock-out would have recorded.
export const closingSummary = ({ record, at, policy }) => {
  const checkInAt = new Date(record.checkIn.at);
  const workedMinutes = Math.max(
    0,
    Math.round((new Date(at).getTime() - checkInAt.getTime()) / 60000)
  );
  const halfDayMinutes = Number(policy?.halfDayMinutes) || 240;

  let status;

  if (workedMinutes > 0 && workedMinutes < halfDayMinutes) {
    status = "Half Day";
  } else if (record.status === "Late") {
    status = "Late";
  } else {
    status = "Present";
  }

  return { workedMinutes, status };
};
