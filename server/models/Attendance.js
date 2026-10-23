import mongoose from "mongoose";

export const ATTENDANCE_STATUSES = [
  "Present",
  "Late",
  "Half Day",
  "Absent",
  "On Leave",
];

export const ATTENDANCE_SOURCES = ["GPS", "Field", "Remote", "Manual"];

const punchSchema = new mongoose.Schema(
  {
    at: {
      type: Date,
      required: true,
    },

    // Manual (regularized) entries have no GPS fix, so coordinates are optional.
    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    accuracyMeters: {
      type: Number,
      default: 0,
    },

    distanceMeters: {
      type: Number,
      default: null,
    },

    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkLocation",
      default: null,
    },

    locationName: {
      type: String,
      default: "",
    },

    withinGeofence: {
      type: Boolean,
      default: false,
    },

    // True when the server, not the employee, closed the day.
    automatic: {
      type: Boolean,
      default: false,
    },

    // Why the server closed the day, shown to the employee and to managers.
    reason: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

// The last position the signed-in app reported while the day was open. The
// automatic clock-out rules read this instead of asking the device directly,
// because a server can never reach a phone on its own.
const lastSeenSchema = new mongoose.Schema(
  {
    at: {
      type: Date,
      required: true,
    },

    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    accuracyMeters: {
      type: Number,
      default: 0,
    },

    distanceMeters: {
      type: Number,
      default: null,
    },

    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkLocation",
      default: null,
    },

    locationName: {
      type: String,
      default: "",
    },

    withinGeofence: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Company-local calendar date (Africa/Dar_es_Salaam), stored as YYYY-MM-DD
    // so one employee can only have one attendance record per day.
    date: {
      type: String,
      required: true,
    },

    checkIn: {
      type: punchSchema,
      default: null,
    },

    checkOut: {
      type: punchSchema,
      default: null,
    },

    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      default: "Present",
    },

    source: {
      type: String,
      enum: ATTENDANCE_SOURCES,
      default: "GPS",
    },

    workedMinutes: {
      type: Number,
      default: 0,
    },

    lateByMinutes: {
      type: Number,
      default: 0,
    },

    note: {
      type: String,
      trim: true,
    },

    regularizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Latest position reported by the employee's browser today.
    lastSeen: {
      type: lastSeenSchema,
      default: null,
    },

    // Last position that was inside a work location, used to estimate the
    // departure time when someone leaves the premises without clocking out.
    lastSeenInsideAt: {
      type: Date,
      default: null,
    },

    // Audit trail of the automatic clock-out checks for this day.
    autoClockOut: {
      evaluatedAt: {
        type: Date,
        default: null,
      },

      // scheduled · left-premises · no-location · none
      outcome: {
        type: String,
        default: "",
      },

      reason: {
        type: String,
        default: "",
      },

      scheduledFor: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index(
  { companyId: 1, employeeId: 1, date: 1 },
  { unique: true }
);
attendanceSchema.index({ companyId: 1, date: 1 });
// The sweep looks for days that are still open, so check-out is part of the key.
attendanceSchema.index({ companyId: 1, date: 1, checkOut: 1 });

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
