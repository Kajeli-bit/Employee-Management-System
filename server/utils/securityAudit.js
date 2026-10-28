import { randomUUID, createHash } from "node:crypto";

import SecurityAuditEvent from "../models/SecurityAuditEvent.js";
import SecurityAuditHead from "../models/SecurityAuditHead.js";

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const plain = typeof value.toHexString === "function" ? value.toHexString() : value;
    if (typeof plain === "string") return plain;
    return Object.fromEntries(
      Object.keys(plain).sort().map((key) => [key, canonicalize(plain[key])])
    );
  }
  return value;
};

const digestFor = (payload) =>
  createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
const isDuplicateKey = (error) => error?.code === 11000;
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const ensureHead = async (companyId) => {
  let head = await SecurityAuditHead.findOne({ companyId }).lean();
  if (head) return head;
  try {
    await SecurityAuditHead.create({ companyId, sequence: 0, digest: "" });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
  head = await SecurityAuditHead.findOne({ companyId }).lean();
  if (!head) throw new Error("Unable to initialize security audit chain");
  return head;
};

const acquireAppendLock = async (companyId, lockId) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await ensureHead(companyId);
    const now = new Date();
    try {
      const head = await SecurityAuditHead.findOneAndUpdate(
        {
          companyId,
          $or: [
            { appendLockExpiresAt: { $exists: false } },
            { appendLockExpiresAt: null },
            { appendLockExpiresAt: { $lte: now } },
          ],
        },
        {
          $set: {
            appendLockId: lockId,
            appendLockExpiresAt: new Date(now.getTime() + 30_000),
          },
        },
        { new: true }
      ).lean();
      if (head) return { head, lockId };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
    await pause(Math.min(10 + attempt * 3, 100));
  }
  throw new Error("Security audit chain is busy; the action was not performed");
};

export const appendSecurityEvent = async ({
  actor,
  action,
  target = null,
  reason,
  outcome,
  details = {},
}) => {
  if (typeof reason !== "string" || !reason.trim()) {
    throw new Error("A reason is required for every security audit event");
  }
  const companyId = actor.companyId;
  const lockId = randomUUID();
  const { head } = await acquireAppendLock(companyId, lockId);
  let keepLock = true;
  try {
    const sequence = head.sequence + 1;
    let event = await SecurityAuditEvent.findOne({ companyId, sequence }).lean();
    if (event) {
      // Recover a completed immutable insert if the process stopped before
      // advancing the head. It must match the current previous digest.
      if (event.previousDigest !== (head.digest || "")) {
        throw new Error("Security audit chain integrity failure");
      }
    } else {
      const occurredAt = new Date();
      const payload = {
        companyId: companyId.toString(),
        actorUserId: actor._id.toString(),
        actorName: actor.name,
        action,
        targetUserId: target?._id?.toString() || null,
        targetName: target?.name || "",
        reason: reason.trim(),
        outcome,
        details: canonicalize(details),
        occurredAt: occurredAt.toISOString(),
        previousDigest: head.digest || "",
        sequence,
      };
      const digest = digestFor(payload);
      [event] = await SecurityAuditEvent.create([{
        ...payload,
        companyId,
        actorUserId: actor._id,
        targetUserId: target?._id || null,
        occurredAt,
        digest,
      }]);
    }

    const updated = await SecurityAuditHead.findOneAndUpdate(
      { _id: head._id, sequence: head.sequence, digest: head.digest || "", appendLockId: lockId },
      {
        $set: { sequence, digest: event.digest },
        $unset: { appendLockId: "", appendLockExpiresAt: "" },
      },
      { new: true }
    );
    if (!updated) throw new Error("Security audit chain could not advance");
    keepLock = false;
    return event;
  } finally {
    if (keepLock) {
      await SecurityAuditHead.updateOne(
        { _id: head._id, appendLockId: lockId },
        { $unset: { appendLockId: "", appendLockExpiresAt: "" } }
      );
    }
  }
};

export const beginSecurityAction = async (input) => {
  const intent = await appendSecurityEvent({ ...input, outcome: "started" });
  return {
    intentId: intent._id,
    succeed: (details = {}) =>
      appendSecurityEvent({ ...input, outcome: "success", details }),
    fail: (details = {}) =>
      appendSecurityEvent({ ...input, outcome: "failure", details }),
  };
};

export const verifyAuditChain = (events, head) => {
  let previousDigest = "";
  let sequence = 1;
  for (const event of events) {
    if (!event?.companyId || !event?.actorUserId || !event?.occurredAt) return false;
    const payload = {
      companyId: event.companyId.toString(),
      actorUserId: event.actorUserId.toString(),
      actorName: event.actorName,
      action: event.action,
      targetUserId: event.targetUserId?.toString() || null,
      targetName: event.targetName || "",
      reason: event.reason,
      outcome: event.outcome,
      details: canonicalize(event.details || {}),
      occurredAt: new Date(event.occurredAt).toISOString(),
      previousDigest,
      sequence,
    };
    if (
      event.sequence !== sequence ||
      event.previousDigest !== previousDigest ||
      digestFor(payload) !== event.digest
    ) return false;
    previousDigest = event.digest;
    sequence += 1;
  }
  return !head || (head.sequence === events.length && head.digest === previousDigest);
};
