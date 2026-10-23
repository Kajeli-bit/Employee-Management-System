import crypto from "crypto";

import Attendance from "../models/Attendance.js";
import Company from "../models/Company.js";
import Employee from "../models/Employee.js";
import WorkLocation from "../models/WorkLocation.js";

import { CAPABILITIES, hasCapability } from "../utils/roles.js";
import { evaluateGeofence, isValidCoordinate, localDateKey } from "../utils/geo.js";
import {
  closingSummary,
  evaluateDay,
} from "../utils/attendanceAutomation.js";
import { getPolicy } from "./attendanceController.js";

const MAX_COMPANIES_PER_RUN = 500;

// The sweep is cheap but it runs on every heartbeat, so an instance does at
// most one per minute. The rules themselves are time-based and idempotent, so
// running it more often only wastes queries.
const NUDGE_INTERVAL_MS = 60 * 1000;
let lastNudgeAt = 0;

const isUnavailableEmployee = (employee) =>
  !employee || ["Exited", "Suspended"].includes(employee.employmentStatus);

// Records the latest position from the employee's browser. The app calls this
// every few minutes while a day is open, which is the only time a web page can
// read a phone's location.
export const recordHeartbeat = async (req, res) => {
  try {
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    const accuracy = Number(req.body?.accuracy);

    if (!isValidCoordinate(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        error: "A valid GPS position is required for a location update.",
      });
    }

    const employee = await Employee.findOne({
      userId: req.user._id,
      companyId: req.user.companyId,
    })
      .select("workMode employmentStatus")
      .lean();

    if (isUnavailableEmployee(employee)) {
      return res.status(200).json({
        success: true,
        tracked: false,
        reason: "no-active-employee",
      });
    }

    const company = await Company.findById(req.user.companyId)
      .select("attendance")
      .lean();
    const policy = getPolicy(company);
    const now = new Date();
    const date = localDateKey(now, policy.timezone);

    const open = await Attendance.findOne({
      companyId: req.user.companyId,
      employeeId: employee._id,
      date,
      checkIn: { $ne: null },
      checkOut: null,
    })
      .select("_id")
      .lean();

    if (!open) {
      return res.status(200).json({
        success: true,
        tracked: false,
        reason: "no-open-day",
      });
    }

    const locations = await WorkLocation.find({
      companyId: req.user.companyId,
      isActive: true,
    }).lean();

    const geofence = evaluateGeofence(
      {
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 0,
      },
      locations
    );

    const update = {
      $set: {
        lastSeen: {
          at: now,
          latitude,
          longitude,
          accuracyMeters: Math.round(
            Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 0
          ),
          distanceMeters: geofence.distanceMeters,
          location: geofence.location?._id || null,
          locationName: geofence.location?.name || "",
          withinGeofence: geofence.withinFence,
        },
      },
    };

    // Keeping the last on-site reading is what makes an honest departure time
    // possible when someone walks out without clocking out.
    if (geofence.withinFence) {
      update.$set.lastSeenInsideAt = now;
    }

    await Attendance.updateOne(
      { _id: open._id, checkOut: null },
      update
    );

    await nudgeSweeps(req.user.companyId);

    return res.status(200).json({
      success: true,
      tracked: true,
      withinGeofence: geofence.withinFence,
      distanceMeters: geofence.distanceMeters,
      locationName: geofence.location?.name || "",
    });
  } catch (error) {
    console.log("ATTENDANCE HEARTBEAT ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to record your location",
    });
  }
};

// Applies the automatic clock-out rules to every day that is still open for one
// company. Idempotent: closing a day twice is impossible because the update is
// guarded by checkOut: null, and the presence check does not depend on how many
// times it ran.
export const sweepCompanyDay = async ({ companyId, now = new Date() }) => {
  const company = await Company.findById(companyId)
    .select("name attendance")
    .lean();

  const summary = {
    company: company?.name || "",
    date: null,
    checked: 0,
    closed: 0,
    scheduled: 0,
    noted: 0,
  };

  if (!company) {
    return summary;
  }

  const policy = getPolicy(company);
  const date = localDateKey(now, policy.timezone);

  summary.date = date;

  const open = await Attendance.find({
    companyId,
    date,
    checkIn: { $ne: null },
    checkOut: null,
  }).lean();

  summary.checked = open.length;

  if (open.length === 0) {
    return summary;
  }

  const employees = await Employee.find({
    _id: { $in: open.map((record) => record.employeeId) },
    companyId,
  })
    .select("workMode")
    .lean();

  const employeesById = new Map(
    employees.map((employee) => [employee._id.toString(), employee])
  );

  // A company with no active fence cannot conclude anybody "left the premises".
  const hasActiveLocations = Boolean(
    await WorkLocation.exists({ companyId, isActive: true })
  );

  for (const record of open) {
    const employee = employeesById.get(record.employeeId.toString()) || null;
    const decision = evaluateDay({
      record,
      employee,
      policy,
      now,
      hasActiveLocations,
    });

    if (!decision) {
      continue;
    }

    if (decision.action === "note") {
      // Written once, so a quiet day does not rewrite the same note every time
      // the sweep runs.
      if (record.autoClockOut?.outcome === decision.outcome) {
        continue;
      }

      await Attendance.updateOne(
        { _id: record._id, checkOut: null },
        {
          $set: {
            "autoClockOut.evaluatedAt": now,
            "autoClockOut.outcome": decision.outcome,
            "autoClockOut.reason": decision.reason,
          },
        }
      );

      summary.noted += 1;
      continue;
    }

    if (decision.action === "schedule") {
      if (record.autoClockOut?.scheduledFor) {
        continue;
      }

      const result = await Attendance.updateOne(
        { _id: record._id, checkOut: null },
        {
          $set: {
            "autoClockOut.evaluatedAt": now,
            "autoClockOut.outcome": decision.outcome,
            "autoClockOut.reason": decision.reason,
            "autoClockOut.scheduledFor": decision.scheduledFor,
          },
        }
      );

      if (result.modifiedCount) {
        summary.scheduled += 1;
      }

      continue;
    }

    const { workedMinutes, status } = closingSummary({
      record,
      at: decision.at,
      policy,
    });

    const seen = record.lastSeen || {};

    const closed = await Attendance.findOneAndUpdate(
      { _id: record._id, checkOut: null },
      {
        $set: {
          checkOut: {
            at: decision.at,
            latitude: seen.latitude ?? null,
            longitude: seen.longitude ?? null,
            accuracyMeters: seen.accuracyMeters ?? 0,
            distanceMeters: seen.distanceMeters ?? null,
            location: seen.location ?? null,
            locationName: seen.locationName || "Automatic clock-out",
            withinGeofence: Boolean(seen.withinGeofence),
            automatic: true,
            reason: decision.reason,
          },
          workedMinutes,
          status,
          "autoClockOut.evaluatedAt": now,
          "autoClockOut.outcome": decision.outcome,
          "autoClockOut.reason": decision.reason,
        },
      },
      { returnDocument: "after" }
    );

    if (closed) {
      summary.closed += 1;
    }
  }

  return summary;
};

// Runs after a heartbeat arrives, so an open employee app keeps the schedule
// moving even on a deployment with no external cron configured.
export const nudgeSweeps = async (companyId) => {
  const now = Date.now();

  if (now - lastNudgeAt < NUDGE_INTERVAL_MS) {
    return null;
  }

  lastNudgeAt = now;

  try {
    return await sweepCompanyDay({ companyId, now: new Date() });
  } catch (error) {
    console.log("ATTENDANCE SWEEP ERROR:", error);

    return null;
  }
};

// Lets HR or the Managing Director run the check on demand, for example when a
// manager notices a night of unclosed days.
export const runCompanySweep = async (req, res) => {
  try {
    if (!hasCapability(req.user.role, CAPABILITIES.ATTENDANCE_MANAGE)) {
      return res.status(403).json({
        success: false,
        error: "You are not allowed to run the attendance check",
      });
    }

    const summary = await sweepCompanyDay({
      companyId: req.user.companyId,
    });

    return res.status(200).json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.log("ATTENDANCE SWEEP ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to run the attendance check",
    });
  }
};

const secretMatches = (provided, expected) => {
  const a = Buffer.from(String(provided || ""));
  const b = Buffer.from(String(expected || ""));

  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Scheduled entry point. Vercel cron sends "Authorization: Bearer <secret>";
// any other scheduler can send ?secret=. Without CRON_SECRET configured the
// route refuses to run rather than exposing an unauthenticated write endpoint.
export const runScheduledSweep = async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      return res.status(503).json({
        success: false,
        error:
          "CRON_SECRET is not configured, so the scheduled attendance check is disabled.",
      });
    }

    const provided =
      String(req.get?.("authorization") || "").replace(/^Bearer\s+/i, "") ||
      String(req.query?.secret || "");

    if (!secretMatches(provided, secret)) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const companies = await Company.find({})
      .select("_id")
      .limit(MAX_COMPANIES_PER_RUN)
      .lean();

    const now = new Date();
    const results = [];

    for (const company of companies) {
      results.push(await sweepCompanyDay({ companyId: company._id, now }));
    }

    return res.status(200).json({
      success: true,
      ranAt: now.toISOString(),
      results,
    });
  } catch (error) {
    console.log("SCHEDULED ATTENDANCE SWEEP ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to run the scheduled attendance check",
    });
  }
};
