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
      required: true,
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
    },
  },
  {
    timestamps: true,
  }
);

const Company = mongoose.model("Company", companySchema);

export default Company;
