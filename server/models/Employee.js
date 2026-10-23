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

    // Optional at onboarding: payroll can place the worker later.
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    // Optional at onboarding; set when payroll is agreed.
    salary: {
      type: Number,
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

    // The site this person normally reports to. Informational for reporting:
    // GPS attendance still accepts any active Nilric location, so someone
    // covering another branch is not locked out.
    workLocation: {
      type: Schema.Types.ObjectId,
      ref: "WorkLocation",
      default: null,
    },

    // Probation is the usual reason an employee is not yet "Active".
    probationEndDate: {
      type: Date,
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

    // NHIF / SHA health insurance membership number.
    nhifNumber: {
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

    bankBranch: {
      type: String,
      trim: true,
    },

    // --- Identification documents -----------------------------------------
    // Field engineers and drivers are asked for a licence; expatriate staff for
    // a passport and work permit.
    drivingLicenceNumber: {
      type: String,
      trim: true,
    },

    passportNumber: {
      type: String,
      trim: true,
    },

    workPermitExpiry: {
      type: Date,
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
