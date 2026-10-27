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

      saturdayWorkStart: {
        type: String,
        default: "09:00",
      },

      saturdayWorkEnd: {
        type: String,
        default: "13:00",
      },

      graceMinutes: {
        type: Number,
        default: 15,
        min: 0,
      },

      requireGeofence: {
        type: Boolean,
        default: true,
      },

      weekendDays: {
        type: [Number],
        default: [0],
      },

      // Close the day for anyone who forgot to clock out.
      autoClockOut: {
        type: Boolean,
        default: true,
      },

      // Minutes before the scheduled weekday/Saturday end when the device is
      // checked for an early exit. Defaults put checks at 15:30 Friday and
      // 11:30 Saturday.
      earlyDepartureCheckMinutes: {
        type: Number,
        default: 90,
        min: 0,
      },

      // Minutes before the scheduled end when a recent position is required
      // for automatic clock-out. Defaults put it at 16:45 weekdays and 12:45
      // Saturday.
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
