import mongoose from "mongoose";

import { DEFAULT_TIMEZONE } from "../utils/geo.js";

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    head: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // Empty until the first sign-in claims the company as Managing Director.
      default: null,
    },

    // Attendance policy shared by everyone in the company.
    attendance: {
      timezone: {
        type: String,
        default: DEFAULT_TIMEZONE,
      },

      workStart: {
        type: String,
        default: "08:00",
      },

      workEnd: {
        type: String,
        default: "17:00",
      },

      graceMinutes: {
        type: Number,
        default: 15,
        min: 0,
      },

      halfDayMinutes: {
        type: Number,
        default: 240,
        min: 0,
      },

      requireGeofence: {
        type: Boolean,
        default: true,
      },

      weekendDays: {
        type: [Number],
        default: [0, 6],
      },

      // Close the day for anyone who forgot to clock out.
      autoClockOut: {
        type: Boolean,
        default: true,
      },

      // Minutes before workEnd when the device is checked for an early exit.
      // 90 minutes puts the first check at 15:30 for a 17:00 finish.
      earlyDepartureCheckMinutes: {
        type: Number,
        default: 90,
        min: 0,
      },

      // Minutes before workEnd when the device must still be on site for the
      // automatic clock-out at workEnd. 15 minutes puts it at 16:45.
      autoClockOutConfirmMinutes: {
        type: Number,
        default: 15,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

const Company = mongoose.model("Company", companySchema);

export default Company;
