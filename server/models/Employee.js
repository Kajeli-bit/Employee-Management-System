import mongoose from "mongoose";
import { Schema } from "mongoose";

export const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Intern",
  "Casual",
];

export const EMPLOYMENT_STATUSES = [
  "Active",
  "Probation",
  "On Leave",
  "Suspended",
  "Exited",
];

export const WORK_MODES = ["Office", "Field", "Remote"];

const employeeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    dob: {
      type: Date,
    },

    gender: {
      type: String,
      trim: true,
    },

    maritalStatus: {
      type: String,
      trim: true,
    },

    designation: {
      type: String,
      trim: true,
    },

    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },

    salary: {
      type: Number,
      required: true,
    },

    // --- Employment record ------------------------------------------------
    employmentType: {
      type: String,
      enum: EMPLOYMENT_TYPES,
      default: "Full-time",
    },

    employmentStatus: {
      type: String,
      enum: EMPLOYMENT_STATUSES,
      default: "Active",
    },

    dateOfJoining: {
      type: Date,
    },

    contractEndDate: {
      type: Date,
    },

    // Office staff must clock in inside a work location geofence. Field staff
    // can clock in anywhere and the record is flagged as a field check-in.
    workMode: {
      type: String,
      enum: WORK_MODES,
      default: "Office",
    },

    // --- Contact ----------------------------------------------------------
    phone: {
      type: String,
      trim: true,
    },

    personalEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    city: {
      type: String,
      trim: true,
    },

    region: {
      type: String,
      trim: true,
    },

    // --- Statutory and payroll (Tanzania) ---------------------------------
    nationalId: {
      type: String,
      trim: true,
    },

    tin: {
      type: String,
      trim: true,
    },

    nssfNumber: {
      type: String,
      trim: true,
    },

    bankName: {
      type: String,
      trim: true,
    },

    bankAccountName: {
      type: String,
      trim: true,
    },

    bankAccountNumber: {
      type: String,
      trim: true,
    },

    // --- Emergency contact -------------------------------------------------
    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true },
    },

    // --- Qualifications ----------------------------------------------------
    qualification: {
      type: String,
      trim: true,
    },

    fieldOfStudy: {
      type: String,
      trim: true,
    },

    certifications: {
      type: [String],
      default: [],
    },

    skills: {
      type: [String],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  }
);

employeeSchema.index({
  companyId: 1,
  userId: 1,
});

employeeSchema.index({
  companyId: 1,
  department: 1,
});

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;
