import mongoose from "mongoose";

import { ROLES, ROLE_KEYS, LEGACY_ROLE_KEYS } from "../utils/roles.js";

const userSchema = new mongoose.Schema({
  clerkUserId: {
    type: String,
    unique: true,
    sparse: true,
  },

  clerkUserCreatedByEMS: {
    type: Boolean,
    default: false,
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },

  dob: {
    type: Date,
    required: true,
  },

  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  password: {
    type: String,
    required: false,
  },

  // Nilric position on the organisation chart. Levels and capabilities live in
  // utils/roles.js; legacy keys stay accepted so older accounts keep working.
  role: {
    type: String,
    enum: [...ROLE_KEYS, ...LEGACY_ROLE_KEYS],
    default: ROLES.employee.key,
    required: true,
  },

  designation: {
    type: String,
    required: true,
    trim: true,
  },

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },

  // Direct supervisor. Drives approval routing and the org chart.
  reportsTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  // Company-wide visibility override. Department-scoped roles (e.g. an HR
  // manager) with this flag see every department like company leadership,
  // while keeping their level for seniority checks.
  companyScope: {
    type: Boolean,
    default: false,
  },

  profileImage: {
    type: String,
  },

  profileImagePublicId: {
    type: String,
  },

  lastLoginAt: {
    type: Date,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.index({ companyId: 1, role: 1 });
userSchema.index({ companyId: 1, reportsTo: 1 });

const User = mongoose.model("User", userSchema);

export default User;
