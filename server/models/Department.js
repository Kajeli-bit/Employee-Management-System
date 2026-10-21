import mongoose from "mongoose";

// Departments and their teams share one collection so the organisation chart
// can be rendered as a two-level tree. `kind` distinguishes a department from a
// unit inside it.
const departmentSchema = new mongoose.Schema(
  {
    dep_name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
    },

    kind: {
      type: String,
      enum: ["department", "team"],
      default: "department",
    },

    // Stable slug used to link the stored department to the organisation chart
    // (for example "technical_ict").
    key: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
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

departmentSchema.index(
  { companyId: 1, dep_name: 1 },
  { unique: true }
);

departmentSchema.index({ companyId: 1, parent: 1 });
departmentSchema.index({ companyId: 1, key: 1 });

const Department = mongoose.model("Department", departmentSchema);

export default Department;
