import mongoose from "mongoose";

const securityAuditHeadSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    sequence: { type: Number, default: 0, min: 0 },
    digest: { type: String, default: "" },
    superUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    superUserClaimToken: { type: String, default: null },
    superUserClaimExpiresAt: { type: Date, default: null },
    appendLockId: { type: String, default: null },
    appendLockExpiresAt: { type: Date, default: null },
  },
  { versionKey: false }
);

securityAuditHeadSchema.index({ companyId: 1 }, { unique: true });

const SecurityAuditHead = mongoose.models.SecurityAuditHead || mongoose.model("SecurityAuditHead", securityAuditHeadSchema);
export default SecurityAuditHead;
