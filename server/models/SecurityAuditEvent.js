import mongoose from "mongoose";

const securityAuditEventSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, immutable: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    actorName: { type: String, required: true, immutable: true },
    action: { type: String, required: true, immutable: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, immutable: true },
    targetName: { type: String, default: "", immutable: true },
    reason: { type: String, required: true, maxlength: 500, immutable: true },
    outcome: { type: String, enum: ["started", "success", "failure"], required: true, immutable: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
    previousDigest: { type: String, default: "", immutable: true },
    sequence: { type: Number, required: true, immutable: true },
    digest: { type: String, required: true, immutable: true },
    occurredAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false }
);

securityAuditEventSchema.index({ companyId: 1, sequence: 1 }, { unique: true });
securityAuditEventSchema.index({ companyId: 1, occurredAt: -1 });
securityAuditEventSchema.index({ companyId: 1, action: 1, occurredAt: -1 });

securityAuditEventSchema.pre("save", function rejectAuditEdits() {
  if (!this.isNew) throw new Error("Security audit events are append-only");
});

for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete", "replaceOne"]) {
  securityAuditEventSchema.pre(operation, function rejectAuditMutation() {
    throw new Error("Security audit events are append-only");
  });
}

const SecurityAuditEvent = mongoose.models.SecurityAuditEvent || mongoose.model("SecurityAuditEvent", securityAuditEventSchema);
export default SecurityAuditEvent;
