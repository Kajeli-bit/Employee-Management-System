import Attendance from "../models/Attendance.js";
import Company from "../models/Company.js";
import Employee from "../models/Employee.js";
import User from "../models/User.js";
import WorkLocation from "../models/WorkLocation.js";

import { CAPABILITIES, hasCapability, roleLevel } from "../utils/roles.js";
import {
  DEFAULT_TIMEZONE,
  evaluateGeofence,
  isDateKey,
  isValidCoordinate,
  localDateKey,
  localMinutesOfDay,
  localTimeParts,
  timeStringToMinutes,
  zonedTimeToUtc,
} from "../utils/geo.js";
import {
  accessibleEmployeeFilter,
  canManageEmployee,
  canViewEmployee,
  getActorEmployee,
} from "../utils/access.js";

const DEFAULT_POLICY = {
  timezone: DEFAULT_TIMEZONE,
  workStart: "08:00",
  workEnd: "17:00",
  saturdayWorkStart: "09:00",
  saturdayWorkEnd: "13:00",
  graceMinutes: 15,
  requireGeofence: true,
  weekendDays: [0],
  // Automatic clock-out: an early-departure check 90 minutes before the end of
  // the day, a presence check 15 minutes before, and the close itself at the
  // end of the day.
  autoClockOut: true,
  earlyDepartureCheckMinutes: 90,
  autoClockOutConfirmMinutes: 15,
};

// Also used by the automatic clock-out sweep, so the two never drift apart.
export const getPolicy = (company) => ({
  ...DEFAULT_POLICY,
  ...(company?.attendance || {}),
});

const getCompany = (companyId) =>
  Company.findById(companyId).select("attendance name").lean();

const shiftEndAt = (date, policy) => {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const workEnd =
    weekday === 6
      ? policy.saturdayWorkEnd || "13:00"
      : policy.workEnd || "17:00";

  return zonedTimeToUtc(date, workEnd, policy.timezone);
};

const displayStatus = (status) => {
  if (status === "Present") return "On Time";
  if (status === "Half Day") return "Absconder";
  return status;
};

const earlyDepartureAt = (record, policy) => {
  const checkOutAt = record?.checkOut?.at;
  if (!checkOutAt || record.checkOut?.automatic) {
    return Boolean(record?.earlyDeparture);
  }

  const scheduledEnd = shiftEndAt(record.date, policy);
  return Boolean(
    scheduledEnd &&
      (record.earlyDeparture || new Date(checkOutAt) < scheduledEnd)
  );
};

const serializeLocations = (locations) =>
  locations.map((location) => ({
    _id: location._id,
    name: location.name,
    address: location.address,
    latitude: location.latitude,
    longitude: location.longitude,
    radiusMeters: location.radiusMeters,
    isPrimary: location.isPrimary,
    isActive: location.isActive,
  }));

const serializeRecord = (record) => {
  if (!record) {
    return null;
  }

  return {
    _id: record._id,
    date: record.date,
    status: displayStatus(record.status),
    source: record.source,
    workedMinutes: record.workedMinutes,
    lateByMinutes: record.lateByMinutes,
    note: record.note || "",
    checkIn: record.checkIn
      ? {
          at: record.checkIn.at,
          latitude: record.checkIn.latitude,
          longitude: record.checkIn.longitude,
          accuracyMeters: record.checkIn.accuracyMeters,
          distanceMeters: record.checkIn.distanceMeters,
          locationName: record.checkIn.locationName,
          withinGeofence: record.checkIn.withinGeofence,
        }
      : null,
    checkOut: record.checkOut
      ? {
          at: record.checkOut.at,
          distanceMeters: record.checkOut.distanceMeters,
          locationName: record.checkOut.locationName,
          withinGeofence: record.checkOut.withinGeofence,
          automatic: Boolean(record.checkOut.automatic),
          reason: record.checkOut.reason || "",
        }
      : null,
    // Only meaningful while the day is still open: when the app last reported a
    // position and whether that position was inside a work location.
    tracking:
      record.checkIn && !record.checkOut && record.lastSeen?.at
        ? {
            lastSeenAt: record.lastSeen.at,
            locationName: record.lastSeen.locationName || "",
            withinGeofence: Boolean(record.lastSeen.withinGeofence),
            distanceMeters: record.lastSeen.distanceMeters ?? null,
          }
        : null,
    earlyDeparture: Boolean(record.earlyDeparture),
    earlyDepartureApproved: Boolean(record.earlyDepartureApproved),
    earlyDepartureApprovedBy: record.earlyDepartureApprovedBy || null,
    earlyDepartureApprovedAt: record.earlyDepartureApprovedAt || null,
    autoClockOut: {
      outcome: record.autoClockOut?.outcome || "",
      reason: record.autoClockOut?.reason || "",
      scheduledFor: record.autoClockOut?.scheduledFor || null,
    },
  };
};

const getEmployeeContext = async (user) => {
  const employee = await Employee.findOne({
    userId: user._id,
    companyId: user.companyId,
  })
    .populate("department", "dep_name kind parent")
    .lean();

  return employee;
};

const requireActiveEmployee = async (req, res) => {
  const employee = await getEmployeeContext(req.user);

  if (!employee) {
    res.status(400).json({
      success: false,
      error:
        "No employee record is linked to this account, so attendance cannot be recorded.",
    });

    return null;
  }

  if (["Exited", "Suspended"].includes(employee.employmentStatus)) {
    res.status(403).json({
      success: false,
      error: `Attendance is disabled because this employee is marked ${employee.employmentStatus}.`,
    });

    return null;
  }

  return employee;
};

const parsePosition = (body) => {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracy = Number(body.accuracy);

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 0,
    valid: isValidCoordinate(latitude, longitude),
  };
};

export const getToday = async (req, res) => {
  try {
    const company = await getCompany(req.user.companyId);
    const policy = getPolicy(company);

    const employee = await getEmployeeContext(req.user);
    const locations = await WorkLocation.find({
      companyId: req.user.companyId,
      isActive: true,
    })
      .sort({ isPrimary: -1, name: 1 })
      .lean();

    const date = localDateKey(new Date(), policy.timezone);

    const record = employee
      ? await Attendance.findOne({
          companyId: req.user.companyId,
          employeeId: employee._id,
          date,
        }).lean()
      : null;

    return res.status(200).json({
      success: true,
      date,
      policy,
      locations: serializeLocations(locations),
      employee: employee
        ? {
            _id: employee._id,
            workMode: employee.workMode,
            employmentStatus: employee.employmentStatus,
            department: employee.department?.dep_name || "",
            designation: employee.designation,
          }
        : null,
      record: serializeRecord(record),
    });
  } catch (error) {
    console.log("GET TODAY ATTENDANCE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load today's attendance",
    });
  }
};

export const checkIn = async (req, res) => {
  try {
    const employee = await requireActiveEmployee(req, res);

    if (!employee) {
      return undefined;
    }

    const company = await getCompany(req.user.companyId);
    const policy = getPolicy(company);
    const now = new Date();
    const date = localDateKey(now, policy.timezone);
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();

    if (weekday === 0) {
      return res.status(403).json({
        success: false,
        error: "Attendance cannot be recorded on Sunday because it is a non-working day.",
      });
    }

    const position = parsePosition(req.body);

    if (!position.valid) {
      return res.status(400).json({
        success: false,
        error:
          "A GPS location is required to clock in. Allow location access and try again.",
      });
    }

    const existing = await Attendance.findOne({
      companyId: req.user.companyId,
      employeeId: employee._id,
      date,
    });

    if (existing?.checkIn) {
      return res.status(409).json({
        success: false,
        error: "You have already clocked in today.",
        record: serializeRecord(existing.toObject()),
      });
    }

    const locations = await WorkLocation.find({
      companyId: req.user.companyId,
      isActive: true,
    }).lean();

    const geofence = evaluateGeofence(position, locations);
    const isField = employee.workMode === "Field";
    const isRemote = employee.workMode === "Remote";
    const geofenceRequired =
      policy.requireGeofence && !isField && !isRemote;

    if (geofenceRequired && !geofence.withinFence) {
      const detail = geofence.distanceMeters
        ? `You are ${geofence.distanceMeters} m from ${geofence.location.name} (allowed radius ${geofence.location.radiusMeters} m).`
        : "No active work location is configured for your company.";

      return res.status(403).json({
        success: false,
        error: `Check-in must happen at a Nilric work location. ${detail}`,
        distanceMeters: geofence.distanceMeters,
        locationName: geofence.location?.name || "",
        radiusMeters: geofence.location?.radiusMeters || null,
      });
    }

    const minutesNow = localMinutesOfDay(now, policy.timezone);
    const isSaturday = weekday === 6;
    const workStart = isSaturday
      ? policy.saturdayWorkStart || "09:00"
      : policy.workStart || "08:00";
    const expectedStart =
      timeStringToMinutes(workStart, 8 * 60) +
      Number(policy.graceMinutes || 0);
    const lateByMinutes = Math.max(0, minutesNow - expectedStart);

    const punch = {
      at: now,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyMeters: Math.round(position.accuracy),
      distanceMeters: geofence.distanceMeters,
      location: geofence.location?._id || null,
      locationName: geofence.location?.name || "",
      withinGeofence: geofence.withinFence,
    };

    let record;

    try {
      record = await Attendance.findOneAndUpdate(
        {
          companyId: req.user.companyId,
          employeeId: employee._id,
          date,
          // Matches both a missing and a null check-in (e.g. a manual absence
          // record created by a manager earlier in the day).
          checkIn: null,
        },
        {
          $set: {
            userId: req.user._id,
            checkIn: punch,
            status: lateByMinutes > 0 ? "Late" : "On Time",
            source: isField ? "Field" : isRemote ? "Remote" : "GPS",
            lateByMinutes,
            workedMinutes: 0,
            earlyDeparture: false,
            earlyDepartureApproved: false,
            earlyDepartureApprovedBy: null,
            earlyDepartureApprovedAt: null,
          },
          $setOnInsert: {
            companyId: req.user.companyId,
            employeeId: employee._id,
            date,
          },
        },
        {
          returnDocument: "after",
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: "You have already clocked in today.",
        });
      }

      throw error;
    }

    return res.status(201).json({
      success: true,
      message:
        lateByMinutes > 0
          ? `Clocked in at ${formatClock(now, policy.timezone)}. Marked late by ${lateByMinutes} minutes.`
          : `Clocked in at ${formatClock(now, policy.timezone)}. Marked on time.`,
      record: serializeRecord(record.toObject()),
      distanceMeters: geofence.distanceMeters,
    });
  } catch (error) {
    console.log("CHECK IN ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to record check-in",
    });
  }
};

export const checkOut = async (req, res) => {
  try {
    const employee = await requireActiveEmployee(req, res);

    if (!employee) {
      return undefined;
    }

    const company = await getCompany(req.user.companyId);
    const policy = getPolicy(company);
    const now = new Date();
    const date = localDateKey(now, policy.timezone);
    const position = parsePosition(req.body);

    if (!position.valid) {
      return res.status(400).json({
        success: false,
        error:
          "A GPS location is required to clock out. Allow location access and try again.",
      });
    }

    const record = await Attendance.findOne({
      companyId: req.user.companyId,
      employeeId: employee._id,
      date,
    });

    if (!record?.checkIn) {
      return res.status(400).json({
        success: false,
        error: "You have not clocked in today.",
      });
    }

    if (record.checkOut?.at) {
      return res.status(409).json({
        success: false,
        error: "You have already clocked out today.",
        record: serializeRecord(record.toObject()),
      });
    }

    const locations = await WorkLocation.find({
      companyId: req.user.companyId,
      isActive: true,
    }).lean();

    const geofence = evaluateGeofence(position, locations);
    const workedMinutes = Math.max(
      0,
      Math.round((now.getTime() - record.checkIn.at.getTime()) / 60000)
    );

    const scheduledEnd = shiftEndAt(date, policy);
    const isEarlyDeparture = Boolean(scheduledEnd && now < scheduledEnd);

    record.checkOut = {
      at: now,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyMeters: Math.round(position.accuracy),
      distanceMeters: geofence.distanceMeters,
      location: geofence.location?._id || null,
      locationName: geofence.location?.name || "",
      withinGeofence: geofence.withinFence,
    };

    record.workedMinutes = workedMinutes;
    record.earlyDeparture = isEarlyDeparture;

    if (isEarlyDeparture && !record.earlyDepartureApproved) {
      record.status = "Absconder";
    } else if (record.status !== "Late") {
      record.status = "On Time";
    }

    await record.save();

    return res.status(200).json({
      success: true,
      message: `Clocked out at ${formatClock(now, policy.timezone)}.`,
      record: serializeRecord(record.toObject()),
    });
  } catch (error) {
    console.log("CHECK OUT ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to record check-out",
    });
  }
};

export const getMyAttendance = async (req, res) => {
  try {
    const company = await getCompany(req.user.companyId);
    const policy = getPolicy(company);
    const employee = await getEmployeeContext(req.user);

    if (!employee) {
      return res.status(200).json({
        success: true,
        records: [],
        summary: null,
        policy,
      });
    }

    const to = isDateKey(req.query.to)
      ? req.query.to
      : localDateKey(new Date(), policy.timezone);

    const from = isDateKey(req.query.from)
      ? req.query.from
      : shiftDateKey(to, -30);

    const records = await Attendance.find({
      companyId: req.user.companyId,
      employeeId: employee._id,
      date: { $gte: from, $lte: to },
    })
      .sort({ date: -1 })
      .limit(120)
      .lean();

    return res.status(200).json({
      success: true,
      from,
      to,
      policy,
      records: records.map((record) => ({
        ...serializeRecord(record),
        status: earlyDepartureAt(record, policy) && !record.earlyDepartureApproved
          ? "Absconder"
          : displayStatus(record.status),
      })),
      summary: summarize(records.map((record) => ({
        ...record,
        status:
          earlyDepartureAt(record, policy) && !record.earlyDepartureApproved
            ? "Absconder"
            : displayStatus(record.status),
      }))),
    });
  } catch (error) {
    console.log("GET MY ATTENDANCE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load your attendance",
    });
  }
};

export const getAttendance = async (req, res) => {
  try {
    if (!hasCapability(req.user.role, CAPABILITIES.ATTENDANCE_VIEW)) {
      return res.status(403).json({
        success: false,
        error: "You are not allowed to view attendance records",
      });
    }

    const company = await getCompany(req.user.companyId);
    const policy = getPolicy(company);
    const date = isDateKey(req.query.date)
      ? req.query.date
      : localDateKey(new Date(), policy.timezone);

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 25, 1),
      100
    );
    const skip = (page - 1) * limit;

    // Same population the dashboard counts and the directory lists.
    const employeeFilter = (await accessibleEmployeeFilter(req.user)) || {};

    // Department and team leads are pinned to their own department, so a query
    // parameter cannot widen their view.
    const scopedToDepartment = employeeFilter.department !== undefined;

    if (req.query.department && !scopedToDepartment) {
      employeeFilter.department = req.query.department;
    }

    if (req.query.workMode) {
      employeeFilter.workMode = req.query.workMode;
    }

    if (req.query.search?.trim()) {
      const matchingUsers = await User.find({
        companyId: req.user.companyId,
        name: { $regex: req.query.search.trim(), $options: "i" },
      })
        .select("_id")
        .lean();

      // Narrow within what the user may already see; search never widens scope.
      const allowedIds = employeeFilter.userId?.$in;

      employeeFilter.userId = {
        $in: matchingUsers
          .map((user) => user._id)
          .filter(
            (id) =>
              !allowedIds ||
              allowedIds.some((allowed) => allowed.equals(id))
          ),
      };
    }

    const employees = await Employee.find(employeeFilter)
      .populate("userId", "name email profileImage role")
      .populate("department", "dep_name kind")
      .sort({ employeeId: 1 })
      .lean();

    const attendanceQuery = {
      companyId: req.user.companyId,
      employeeId: { $in: employees.map((employee) => employee._id) },
    };

    attendanceQuery.date = date;

    // "Missing" and "CheckedIn" are roster-level filters, not record statuses.
    if (
      req.query.status &&
      req.query.status !== "Missing" &&
      req.query.status !== "CheckedIn"
    ) {
      attendanceQuery.status =
        req.query.status === "Absconder"
          ? { $in: ["Absconder", "Half Day"] }
          : req.query.status === "On Time"
            ? { $in: ["On Time", "Present"] }
            : req.query.status;
    }

    const records = await Attendance.find(attendanceQuery)
      .sort({ date: -1, "checkIn.at": -1 })
      .lean();

    const recordsByEmployeeDate = new Map();

    for (const record of records) {
      const key = `${record.employeeId}:${record.date}`;

      if (!recordsByEmployeeDate.has(key)) {
        recordsByEmployeeDate.set(key, record);
      }
    }

    const rows = employees.map((employee) => {
      const record =
        recordsByEmployeeDate.get(`${employee._id}:${date}`) || null;

      return {
        employeeId: employee._id,
        userId: employee.userId?._id || null,
        name: employee.userId?.name || "Unknown",
        email: employee.userId?.email || "",
        profileImage: employee.userId?.profileImage || "",
        role: employee.userId?.role || "",
        designation: employee.designation || "",
        department: employee.department?.dep_name || "Not assigned",
        workMode: employee.workMode,
        employmentStatus: employee.employmentStatus,
        record: record
          ? {
              ...serializeRecord(record),
              status:
                earlyDepartureAt(record, policy) && !record.earlyDepartureApproved
                  ? "Absconder"
                  : displayStatus(record.status),
              earlyDeparture: earlyDepartureAt(record, policy),
            }
          : null,
      };
    });

    const statusFilter = req.query.status;
    const filteredRows =
      statusFilter === "Absconder"
        ? rows.filter((row) =>
            displayStatus(row.record?.status) === "Absconder" ||
            (earlyDepartureAt(row.record, policy) &&
              !row.record?.earlyDepartureApproved)
          )
        : statusFilter === "On Time"
          ? rows.filter((row) => ["On Time", "Present"].includes(displayStatus(row.record?.status)))
          : statusFilter === "Missing"
            ? rows.filter((row) => !row.record?.checkIn)
            : statusFilter === "CheckedIn"
              ? rows.filter((row) => row.record?.checkIn)
              : statusFilter
                ? rows.filter(
                    (row) => row.record && row.record.status === statusFilter
                  )
                : rows;

    const total = filteredRows.length;

    const summary = {
      roster: rows.length,
      checkedIn: rows.filter((row) => row.record?.checkIn).length,
      present: rows.filter((row) => ["On Time", "Present"].includes(displayStatus(row.record?.status))).length,
      late: rows.filter((row) => row.record?.status === "Late").length,
      absconders: rows.filter((row) => (earlyDepartureAt(row.record, policy) && !row.record?.earlyDepartureApproved) || displayStatus(row.record?.status) === "Absconder").length,
      onLeave: rows.filter((row) => row.record?.status === "On Leave").length,
      notCheckedIn: rows.filter((row) => !row.record?.checkIn).length,
    };

    return res.status(200).json({
      success: true,
      date,
      policy,
      summary,
      rows: filteredRows.slice(skip, skip + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.log("GET ATTENDANCE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load attendance records",
    });
  }
};

export const getEmployeeHistory = async (req, res) => {
  try {
    if (!hasCapability(req.user.role, CAPABILITIES.ATTENDANCE_VIEW)) {
      return res.status(403).json({
        success: false,
        error: "You are not allowed to view attendance records",
      });
    }

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 30, 1),
      100
    );

    const employee = await Employee.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    })
      .populate("userId", "name role")
      .populate("department", "dep_name")
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    const actorEmployee = await getActorEmployee(req.user);

    const allowed = await canViewEmployee({
      user: req.user,
      actorEmployee,
      targetEmployee: employee,
      targetRole: employee.userId?.role,
    });

    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: "You are not allowed to view this employee",
      });
    }

    const records = await Attendance.find({
      companyId: req.user.companyId,
      employeeId: employee._id,
    })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      employee: {
        _id: employee._id,
        name: employee.userId?.name || employee.name || "Unknown",
        designation: employee.designation || "",
        department: employee.department?.dep_name || "",
      },
      records: records.map((record) => ({
        ...serializeRecord(record),
        status:
          earlyDepartureAt(record, getPolicy(company)) &&
          !record.earlyDepartureApproved
            ? "Absconder"
            : displayStatus(record.status),
        earlyDeparture: earlyDepartureAt(record, getPolicy(company)),
      })),
    });
  } catch (error) {
    console.log("GET EMPLOYEE HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load attendance history",
    });
  }
};

export const markAttendance = async (req, res) => {
  try {
    if (!hasCapability(req.user.role, CAPABILITIES.ATTENDANCE_MANAGE)) {
      return res.status(403).json({
        success: false,
        error: "You are not allowed to regularize attendance",
      });
    }

    const {
      employeeId,
      date,
      checkInTime,
      checkOutTime,
      status = "On Time",
      note,
    } = req.body;

    if (!employeeId || !isDateKey(date)) {
      return res.status(400).json({
        success: false,
        error: "Employee and date (YYYY-MM-DD) are required",
      });
    }

    if (!["On Time", "Late", "Absconder", "Absent", "On Leave"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid attendance status",
      });
    }

    const targetEmployee = await Employee.findOne({
      _id: employeeId,
      companyId: req.user.companyId,
    })
      .populate("userId", "role")
      .lean();

    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    const actorEmployee = await getActorEmployee(req.user);
    const targetRole = targetEmployee.userId?.role;

    const allowed =
      roleLevel(req.user.role) > roleLevel(targetRole) &&
      (await canManageEmployee({
        user: req.user,
        actorEmployee,
        targetEmployee: {
          ...targetEmployee,
          userId: targetEmployee.userId?._id,
        },
        targetRole,
      }));

    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: "You cannot regularize attendance for this employee",
      });
    }

    const company = await getCompany(req.user.companyId);
    const policy = getPolicy(company);

    const toPunch = (timeValue) => {
      if (!timeValue) {
        return null;
      }

      const at = zonedTimeToUtc(date, timeValue, policy.timezone);

      if (!at) {
        return null;
      }

      return {
        at,
        latitude: null,
        longitude: null,
        accuracyMeters: 0,
        distanceMeters: null,
        location: null,
        locationName: "Manual entry",
        withinGeofence: false,
      };
    };

    const checkIn = toPunch(checkInTime);
    const checkOut = toPunch(checkOutTime);

    if (checkInTime && !checkIn) {
      return res.status(400).json({
        success: false,
        error: "Check-in time must be in HH:mm format",
      });
    }

    if (checkOutTime && !checkOut) {
      return res.status(400).json({
        success: false,
        error: "Check-out time must be in HH:mm format",
      });
    }

    const workedMinutes =
      checkIn && checkOut
        ? Math.max(
            0,
            Math.round((checkOut.at.getTime() - checkIn.at.getTime()) / 60000)
          )
        : 0;
    const scheduledEnd = shiftEndAt(date, policy);
    const isEarlyDeparture = Boolean(
      checkOut && scheduledEnd && checkOut.at < scheduledEnd
    );
    const effectiveStatus =
      isEarlyDeparture && !["Absent", "On Leave"].includes(status)
        ? "Absconder"
        : status;

    const record = await Attendance.findOneAndUpdate(
      {
        companyId: req.user.companyId,
        employeeId: targetEmployee._id,
        date,
      },
      {
        $set: {
          userId: targetEmployee.userId?._id,
          checkIn,
          checkOut,
          status: effectiveStatus,
          source: "Manual",
          workedMinutes,
          earlyDeparture: isEarlyDeparture,
          earlyDepartureApproved: false,
          earlyDepartureApprovedBy: null,
          earlyDepartureApprovedAt: null,
          note: note?.trim() || "",
          regularizedBy: req.user._id,
        },
        $setOnInsert: {
          companyId: req.user.companyId,
          employeeId: targetEmployee._id,
          date,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Attendance regularized",
      record: serializeRecord(record.toObject()),
    });
  } catch (error) {
    console.log("MARK ATTENDANCE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to regularize attendance",
    });
  }
};

export const updateAttendance = async (req, res) => {
  try {
    if (!hasCapability(req.user.role, CAPABILITIES.ATTENDANCE_MANAGE)) {
      return res.status(403).json({
        success: false,
        error: "You are not allowed to edit attendance records",
      });
    }

    const record = await Attendance.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "Attendance record not found",
      });
    }

    const targetEmployee = await Employee.findOne({
      _id: record.employeeId,
      companyId: req.user.companyId,
    })
      .populate("userId", "role")
      .lean();

    const actorEmployee = await getActorEmployee(req.user);

    if (
      !targetEmployee ||
      !(await canManageEmployee({
        user: req.user,
        actorEmployee,
        targetEmployee: {
          ...targetEmployee,
          userId: targetEmployee.userId?._id,
        },
        targetRole: targetEmployee.userId?.role,
      }))
    ) {
      return res.status(403).json({
        success: false,
        error: "You cannot edit attendance for this employee",
      });
    }

    const { status, note, approveEarlyDeparture } = req.body;
    const policy = getPolicy(await getCompany(req.user.companyId));
    const hasEarlyDeparture = earlyDepartureAt(record, policy);

    if (approveEarlyDeparture !== undefined && status !== undefined) {
      return res.status(400).json({
        success: false,
        error: "Approve or revoke an early departure separately from a status edit.",
      });
    }

    if (
      approveEarlyDeparture !== undefined &&
      (typeof approveEarlyDeparture !== "boolean" || !hasEarlyDeparture)
    ) {
      return res.status(400).json({
        success: false,
        error: "Only an early departure can be approved or revoked.",
      });
    }

    if (status) {
      if (
        !["On Time", "Late", "Absconder", "Absent", "On Leave"].includes(status)
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid attendance status",
        });
      }

      record.status = status;
    }

    if (approveEarlyDeparture !== undefined) {
      record.earlyDepartureApproved = approveEarlyDeparture;
      record.earlyDepartureApprovedBy = approveEarlyDeparture
        ? req.user._id
        : null;
      record.earlyDepartureApprovedAt = approveEarlyDeparture ? new Date() : null;
      if (hasEarlyDeparture) {
        record.earlyDeparture = true;
        record.status = approveEarlyDeparture
          ? record.lateByMinutes > 0
            ? "Late"
            : "On Time"
          : "Absconder";
      }
    }

    if (note !== undefined) {
      record.note = note?.trim() || "";
    }

    record.regularizedBy = req.user._id;

    await record.save();

    return res.status(200).json({
      success: true,
      message: "Attendance updated",
      record: serializeRecord(record.toObject()),
    });
  } catch (error) {
    console.log("UPDATE ATTENDANCE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to update attendance",
    });
  }
};

const formatClock = (date, timeZone) => {
  const { hour, minute } = localTimeParts(date, timeZone);

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const shiftDateKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return shifted.toISOString().slice(0, 10);
};

const summarize = (records) => ({
  days: records.length,
  present: records.filter((record) => ["On Time", "Present"].includes(displayStatus(record.status))).length,
  late: records.filter((record) => record.status === "Late").length,
  absconders: records.filter((record) => record.status === "Absconder").length,
  absent: records.filter((record) => record.status === "Absent").length,
  onLeave: records.filter((record) => record.status === "On Leave").length,
  totalMinutes: records.reduce(
    (total, record) => total + (record.workedMinutes || 0),
    0
  ),
});

