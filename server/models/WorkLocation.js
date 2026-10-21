import mongoose from "mongoose";

// A physical Nilric site. GPS attendance is accepted inside radiusMeters of the
// site's coordinates.
const workLocationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },

    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },

    radiusMeters: {
      type: Number,
      default: 200,
      min: 25,
      max: 10000,
    },

    isPrimary: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

workLocationSchema.index({ companyId: 1, isActive: 1 });

const WorkLocation = mongoose.model(
  "WorkLocation",
  workLocationSchema
);

export default WorkLocation;
