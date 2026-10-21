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

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
