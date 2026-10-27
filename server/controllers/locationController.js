import Company from "../models/Company.js";
import WorkLocation from "../models/WorkLocation.js";

import { CAPABILITIES, hasCapability } from "../utils/roles.js";
import { isValidCoordinate } from "../utils/geo.js";

const requiresLocationManagement = (req, res) => {
  if (!hasCapability(req.user.role, CAPABILITIES.LOCATIONS_MANAGE)) {
    res.status(403).json({
      success: false,
      error: "You are not allowed to manage work locations",
    });

    return false;
  }

  return true;
};

const readLocationBody = (body) => {
  const name = body.name?.trim();
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const radiusMeters = Number(body.radiusMeters);

  if (!name) {
    return { error: "Location name is required" };
  }

  if (!isValidCoordinate(latitude, longitude)) {
    return {
      error:
        "Valid latitude and longitude are required. Use the current-location button to capture them.",
    };
  }

  if (!Number.isFinite(radiusMeters) || radiusMeters < 25 || radiusMeters > 10000) {
    return { error: "Radius must be between 25 and 10000 metres" };
  }

  return {
    value: {
      name,
      address: body.address?.trim() || "",
      latitude,
      longitude,
      radiusMeters: Math.round(radiusMeters),
      isPrimary: Boolean(body.isPrimary),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    },
  };
};

const clearOtherPrimary = async (companyId, locationId) => {
  await WorkLocation.updateMany(
    { companyId, _id: { $ne: locationId } },
    { $set: { isPrimary: false } }
  );
};

export const getLocations = async (req, res) => {
  try {
    const canManage = hasCapability(
      req.user.role,
      CAPABILITIES.LOCATIONS_MANAGE
    );

    const query = {
      companyId: req.user.companyId,
    };

    if (!canManage || req.query.includeInactive !== "true") {
      query.isActive = true;
    }

    const locations = await WorkLocation.find(query)
      .sort({ isPrimary: -1, name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      locations,
      canManage,
    });
  } catch (error) {
    console.log("GET WORK LOCATIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load work locations",
    });
  }
};

export const addLocation = async (req, res) => {
  try {
    if (!requiresLocationManagement(req, res)) {
      return undefined;
    }

    const { value, error } = readLocationBody(req.body);

    if (error) {
      return res.status(400).json({ success: false, error });
    }

    const location = await WorkLocation.create({
      ...value,
      companyId: req.user.companyId,
      createdBy: req.user._id,
    });

    if (location.isPrimary) {
      await clearOtherPrimary(req.user.companyId, location._id);
    }

    return res.status(201).json({
      success: true,
      message: "Work location added",
      location,
    });
  } catch (error) {
    console.log("ADD WORK LOCATION ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to add work location",
    });
  }
};

export const updateLocation = async (req, res) => {
  try {
    if (!requiresLocationManagement(req, res)) {
      return undefined;
    }

    const { value, error } = readLocationBody(req.body);

    if (error) {
      return res.status(400).json({ success: false, error });
    }

    const location = await WorkLocation.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { $set: value },
      { returnDocument: "after", runValidators: true }
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        error: "Work location not found",
      });
    }

    if (location.isPrimary) {
      await clearOtherPrimary(req.user.companyId, location._id);
    }

    return res.status(200).json({
      success: true,
      message: "Work location updated",
      location,
    });
  } catch (error) {
    console.log("UPDATE WORK LOCATION ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to update work location",
    });
  }
};

export const deactivateLocation = async (req, res) => {
  try {
    if (!requiresLocationManagement(req, res)) {
      return undefined;
    }

    // Locations are deactivated rather than deleted so historic attendance keeps
    // a meaningful site reference.
    const location = await WorkLocation.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { $set: { isActive: false, isPrimary: false } },
      { returnDocument: "after" }
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        error: "Work location not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Work location deactivated. It no longer accepts check-ins.",
      location,
    });
  } catch (error) {
    console.log("DEACTIVATE WORK LOCATION ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to deactivate work location",
    });
  }
};

export const getAttendancePolicy = async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId)
      .select("name attendance")
      .lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }

    return res.status(200).json({
      success: true,
      companyName: company.name,
      policy: company.attendance,
      canManage: hasCapability(
        req.user.role,
        CAPABILITIES.SETTINGS_MANAGE
      ),
    });
  } catch (error) {
    console.log("GET ATTENDANCE POLICY ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load attendance policy",
    });
  }
};

export const updateAttendancePolicy = async (req, res) => {
  try {
    if (!hasCapability(req.user.role, CAPABILITIES.SETTINGS_MANAGE)) {
      return res.status(403).json({
        success: false,
        error: "Only company leadership can change the attendance policy",
      });
    }

    const timePattern = /^([01]?\d|2[0-3]):[0-5]\d$/;
    const {
      workStart,
      workEnd,
      saturdayWorkStart,
      saturdayWorkEnd,
      graceMinutes,
      requireGeofence,
      autoClockOut,
      earlyDepartureCheckMinutes,
      autoClockOutConfirmMinutes,
    } = req.body;

    if (workStart && !timePattern.test(workStart)) {
      return res.status(400).json({
        success: false,
        error: "Work start must be in HH:mm format",
      });
    }

    if (workEnd && !timePattern.test(workEnd)) {
      return res.status(400).json({
        success: false,
        error: "Work end must be in HH:mm format",
      });
    }

    if (saturdayWorkStart && !timePattern.test(saturdayWorkStart)) {
      return res.status(400).json({
        success: false,
        error: "Saturday work start must be in HH:mm format",
      });
    }

    if (saturdayWorkEnd && !timePattern.test(saturdayWorkEnd)) {
      return res.status(400).json({
        success: false,
        error: "Saturday work end must be in HH:mm format",
      });
    }

    const update = {};

    if (workStart) update["attendance.workStart"] = workStart;
    if (workEnd) update["attendance.workEnd"] = workEnd;
    if (saturdayWorkStart) {
      update["attendance.saturdayWorkStart"] = saturdayWorkStart;
    }
    if (saturdayWorkEnd) {
      update["attendance.saturdayWorkEnd"] = saturdayWorkEnd;
    }

    // Saving a policy through this endpoint always makes Sunday a non-working
    // day while Saturday remains part of the schedule.
    update["attendance.weekendDays"] = [0];

    if (graceMinutes !== undefined) {
      update["attendance.graceMinutes"] = Math.max(
        0,
        Math.min(120, Number(graceMinutes) || 0)
      );
    }

    if (requireGeofence !== undefined) {
      update["attendance.requireGeofence"] = Boolean(requireGeofence);
    }

    // Automatic clock-out settings. The early check runs this many minutes
    // before workEnd, the presence check this many minutes before, so the
    // defaults put them at 15:30 and 16:45 for a 17:00 finish.
    if (autoClockOut !== undefined) {
      update["attendance.autoClockOut"] = Boolean(autoClockOut);
    }

    if (earlyDepartureCheckMinutes !== undefined) {
      update["attendance.earlyDepartureCheckMinutes"] = Math.max(
        0,
        Math.min(480, Number(earlyDepartureCheckMinutes) || 0)
      );
    }

    if (autoClockOutConfirmMinutes !== undefined) {
      update["attendance.autoClockOutConfirmMinutes"] = Math.max(
        0,
        Math.min(240, Number(autoClockOutConfirmMinutes) || 0)
      );
    }

    const company = await Company.findByIdAndUpdate(
      req.user.companyId,
      { $set: update },
      { returnDocument: "after", runValidators: true }
    )
      .select("name attendance")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Attendance policy updated",
      policy: company.attendance,
    });
  } catch (error) {
    console.log("UPDATE ATTENDANCE POLICY ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to update attendance policy",
    });
  }
};
