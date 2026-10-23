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
//   15:30  early departure  weekday location check → remember the last
//                           on-site time and queue close for 17:00.
//   16:45  presence check   recent location confirms the day is still active.
//   17:00  auto clock-out   close the days queued by either check.
// Saturdays use the same offsets from 13:00 (11:30 / 12:45 / 13:00); Sundays
// are non-working days.
//
// Field and remote staff work away from the office by definition, so they are
// never closed early for being outside a fence. They close at their scheduled
// end only after a recent presence check confirms the day was still active.
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
    saturdayWorkStart,
    saturdayWorkEnd,
    saturdayEarlyDepartureAt: clockString(
      saturdayWorkEndMinutes - earlyMinutes
    ),
    saturdayConfirmAt: clockString(saturdayWorkEndMinutes - confirmMinutes),
    saturdayCloseAt: saturdayWorkEnd,
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

const departureTime = ({ lastSeenInsideAt, checkInAt, now }) => {
  const inside =
    lastSeenInsideAt && lastSeenInsideAt > checkInAt ? lastSeenInsideAt : null;
  const at = inside || checkInAt;

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
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const workEnd = weekday === 6 ? rules.saturdayCloseAt : rules.workEnd;
  const earlyDepartureAt =
    weekday === 6 ? rules.saturdayEarlyDepartureAt : rules.earlyDepartureAt;
  const confirmAt = weekday === 6 ? rules.saturdayConfirmAt : rules.confirmAt;
  const earlyAt = zonedTimeToUtc(date, earlyDepartureAt, rules.timezone);
  const confirmAtUtc = zonedTimeToUtc(date, confirmAt, rules.timezone);
  const closeAt = zonedTimeToUtc(date, workEnd, rules.timezone);

  if (weekday === 0 || !earlyAt || !confirmAtUtc || !closeAt) {
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

  if (
    scheduledFor &&
    record.autoClockOut?.outcome === "left-premises" &&
    last?.withinGeofence === true &&
    new Date(last.at) > new Date(record.autoClockOut.evaluatedAt || 0)
  ) {
    return {
      action: "cancel-schedule",
      outcome: "returned-on-site",
      reason: `Device returned to ${last.locationName || "the work location"} at ${clockLabel(last.at, rules.timezone)} before shift end.`,
    };
  }

  // A queued day closes at its scheduled end, whether for an early departure
  // or because presence at the confirmation check was verified.
  if (scheduledFor) {
    if (now < scheduledFor) {
      return null;
    }

    return {
      action: "clock-out",
      at: scheduledFor,
      outcome: record.autoClockOut?.outcome || "scheduled",
      reason:
        record.autoClockOut?.reason ||
        `Device was on site at the ${confirmAt} check. Closed automatically at ${workEnd}.`,
    };
  }

  // 2 · If the most recent fix is off-site and newer than the last on-site fix,
  // remember that departure at the early check and queue the close. The outside
  // fix may have arrived before this check; attendance stays open until shift end.
  if (
    fenced &&
    now >= earlyAt &&
    now < closeAt &&
    last &&
    new Date(last.at) > (lastSeenInsideAt || checkInAt) &&
    last.withinGeofence === false
  ) {
    const estimatedDepartureAt = departureTime({
      lastSeenInsideAt,
      checkInAt,
      now,
    });

    return {
      action: "schedule",
      scheduledFor: closeAt,
      outcome: "left-premises",
      reason: `Device left ${
        last.locationName || "the work location"
      } at ${clockLabel(last.at, rules.timezone)}. Last seen on site at ${clockLabel(
        estimatedDepartureAt,
        rules.timezone
      )}; the day will close automatically at ${clockLabel(closeAt, rules.timezone)}.`,
    };
  }

  if (now < confirmAtUtc) {
    return null;
  }

  // 3 · Presence check. Without a recent fix the system cannot tell whether
  // the person is still at work or simply closed the app, so it does not guess.
  const presenceAt = last ? new Date(last.at) : null;
  const presenceVerified =
    presenceAt &&
    presenceAt >=
      new Date(
        confirmAtUtc.getTime() - PRESENCE_TOLERANCE_MINUTES * MINUTE_MS
      );

  if (!presenceVerified) {
    return {
      action: "note",
      outcome: "no-location",
      reason: `No location arrived from the device around ${confirmAt}, so the day was left open for review.`,
    };
  }

  if (!fenced || last.withinGeofence) {
    return {
      action: "schedule",
      scheduledFor: closeAt,
      outcome: "scheduled",
      reason: `Device on site at the ${confirmAt} check. The day closes automatically at ${workEnd}.`,
    };
  }

  const estimatedDepartureAt = departureTime({
    lastSeenInsideAt,
    checkInAt,
    now,
  });

  return {
    action: "schedule",
    scheduledFor: closeAt,
    outcome: "left-premises",
    reason: `Device left ${
      last.locationName || "the work location"
    } at ${clockLabel(last.at, rules.timezone)}. Last seen on site at ${clockLabel(
      estimatedDepartureAt,
      rules.timezone
    )}; the day will close automatically at ${clockLabel(closeAt, rules.timezone)}.`,
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
