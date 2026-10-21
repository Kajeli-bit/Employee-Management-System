
import mongoose from "mongoose";

const salarySchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    basicSalary: {
      type: Number,
      required: true,
    },

    allowances: {
      type: Number,
      default: 0,
    },

    deductions: {
      type: Number,
      default: 0,
    },

    netSalary: {
      type: Number,
      required: true,
    },

    payDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["Paid", "Pending"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

salarySchema.index({
  companyId: 1,
  employeeId: 1,
});

const Salary = mongoose.model(
  "Salary",
  salarySchema
);

export default Salary;

