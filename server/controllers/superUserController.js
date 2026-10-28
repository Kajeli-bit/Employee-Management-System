import { clerkClient, getAuth } from "@clerk/express";
import { timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";

import Attendance from "../models/Attendance.js";
import Company from "../models/Company.js";
import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import Leave from "../models/Leave.js";
import Salary from "../models/Salary.js";
import SecurityAuditEvent from "../models/SecurityAuditEvent.js";
import SecurityAuditHead from "../models/SecurityAuditHead.js";
import User from "../models/User.js";
import WorkLocation from "../models/WorkLocation.js";
import { beginSecurityAction, verifyAuditChain } from "../utils/securityAudit.js";
import { provisionSuperUserAccount, SuperUserProvisioningError } from "../utils/superUserProvisioning.js";
import { isSuperUser } from "../middleware/superUser.js";

const safeActor = (user) => ({ _id: user._id, companyId: user.companyId, name: user.name });
const validReason = (reason) => typeof reason === "string" && reason.trim().length >= 8 && reason.trim().length <= 500;
const toSafeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  accountType: user.accountType,
  accountStatus: user.accountStatus,
  hasEmployeeRecord: false,
  lastLoginAt: user.lastLoginAt || null,
});

export const bootstrapSuperUser = async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ success: false, error: "Sign in to the Clerk account that will become the super-user" });

  const key = process.env.SUPER_USER_BOOTSTRAP_KEY;
  const configuredCompanyId = process.env.SUPER_USER_COMPANY_ID;
  const provided = Buffer.from(String(req.get("x-super-user-bootstrap-key") || ""), "utf8");
  const expected = Buffer.from(key || "", "utf8");
  if (!configuredCompanyId || expected.length < 32 || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return res.status(403).json({ success: false, error: "Valid bootstrap credentials are required" });
  }

  const companyId = String(req.body?.companyId || "").toLowerCase();
  if (!mongoose.isValidObjectId(companyId) || companyId !== configuredCompanyId.toLowerCase()) {
    return res.status(403).json({ success: false, error: "Bootstrap is restricted to the configured company" });
  }

  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const result = await provisionSuperUserAccount({
      companyId,
      clerkUserId,
      clerkUser,
      reason: req.body?.reason,
    });
    return res.status(201).json({ success: true, company: result.company.name, account: toSafeUser(result.user) });
  } catch (error) {
    if (error instanceof SuperUserProvisioningError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error("SUPER USER BOOTSTRAP ERROR:", error);
    return res.status(500).json({ success: false, error: "Unable to provision super-user" });
  }
};

export const getSecurityOverview = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const [employeeCount, totalEmployeeAccounts, superUser, users, head] = await Promise.all([
      Employee.countDocuments({ companyId, userId: { $ne: null } }),
      User.countDocuments({ companyId, clerkUserId: { $ne: null }, accountType: { $ne: "super_user" } }),
      User.findOne({ companyId, accountType: "super_user" }).select("_id name email role accountType accountStatus lastLoginAt companyScope").lean(),
      User.find({ companyId, clerkUserId: { $ne: null }, accountType: { $ne: "super_user" } })
        .select("name email role accountStatus lastLoginAt clerkUserId")
        .sort({ name: 1, _id: 1 })
        .limit(500)
        .lean(),
      SecurityAuditHead.findOne({ companyId }).lean(),
    ]);
    const events = await SecurityAuditEvent.find({ companyId })
      .sort({ sequence: 1 })
      .limit(5001)
      .lean();

    const identityStatus = await Promise.all(users.map(async (user) => {
      try {
      const [clerkUser, sessions] = await Promise.all([
        clerkClient.users.getUser(user.clerkUserId),
        clerkClient.sessions.getSessionList({ userId: user.clerkUserId, status: "active", limit: 1 }),
      ]);
        return {
          ...toSafeUser(user),
          mfaEnabled: Boolean(clerkUser.twoFactorEnabled),
          totpEnabled: Boolean(clerkUser.totpEnabled),
          phoneMfaEnabled: Boolean(clerkUser.phoneNumbers?.some((phone) => phone.reservedForSecondFactor)),
          activeSessionCount: sessions.totalCount || 0,
          lastLoginAt: clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt).toISOString() : user.lastLoginAt || null,
        };
      } catch {
        return { ...toSafeUser(user), mfaEnabled: null, totpEnabled: null, phoneMfaEnabled: null, activeSessionCount: null };
      }
    }));

    const reportedCount = Number(head?.sequence || 0);
    const auditComplete = reportedCount <= 5000 && events.length === reportedCount;
    return res.json({
      success: true,
      overview: {
        superUser: superUser ? { ...toSafeUser(superUser), companyScope: superUser.companyScope } : null,
        employeeDirectoryExcludesSuperUser: !superUser || !(await Employee.exists({ companyId, userId: superUser._id })),
        totalEmployeeAccounts,
        accountListLimit: 500,
        employeeRecords: employeeCount,
        accounts: identityStatus,
        audit: {
          integrity: auditComplete && verifyAuditChain(events, head) ? "verified" : "integrity-warning",
          events: events.slice(-100).reverse().map(({ _id, actorName, action, targetName, reason, outcome, occurredAt, digest }) => ({ id: _id, actorName, action, targetName, reason, outcome, occurredAt, digest })),
          totalEvents: reportedCount,
        },
      },
    });
  } catch (error) {
    console.error("SECURITY OVERVIEW ERROR:", error);
    return res.status(500).json({ success: false, error: "Unable to load security overview" });
  }
};

export const recoverAccount = async (req, res) => {
  const { userId } = req.params;
  const { action, reason } = req.body;
  if (!mongoose.isValidObjectId(userId) || !["suspend", "reactivate", "revoke-sessions"].includes(action) || !validReason(reason)) {
    return res.status(400).json({ success: false, error: "Choose a valid recovery action and provide a reason of at least 8 characters" });
  }
  if (action === "suspend" && userId === req.user._id.toString()) {
    return res.status(400).json({ success: false, error: "The super-user cannot suspend their own account" });
  }

  try {
    const target = await User.findOne({ _id: userId, companyId: req.user.companyId, accountType: { $ne: "super_user" } });
    if (!target) return res.status(404).json({ success: false, error: "Company account not found" });

    const audit = await beginSecurityAction({ actor: safeActor(req.user), action: `account.${action}`, target, reason, details: {} });
    try {
      let revokedSessions = 0;
      if (action === "revoke-sessions") {
        if (!target.clerkUserId) throw new Error("Account is not linked to Clerk");
        const sessions = await clerkClient.sessions.getSessionList({ userId: target.clerkUserId, status: "active", limit: 501 });
        const ownedSessions = sessions.data.filter((session) => session.userId === target.clerkUserId);
        if (ownedSessions.length !== sessions.data.length) throw new Error("Session ownership validation failed");
        if (sessions.totalCount > ownedSessions.length || sessions.data.length > 500) {
          throw new Error("Too many active sessions to revoke safely in one recovery action");
        }
        for (const session of ownedSessions) {
          await clerkClient.sessions.revokeSession(session.id);
          revokedSessions += 1;
        }
      } else {
        const updated = await User.findOneAndUpdate(
          { _id: target._id, companyId: req.user.companyId, accountType: { $ne: "super_user" } },
          { $set: { accountStatus: action === "suspend" ? "suspended" : "active", updatedAt: new Date() } },
          { new: true, runValidators: true }
        );
        if (!updated) throw new Error("Account status could not be updated");
        target.accountStatus = updated.accountStatus;
      }
      await audit.succeed({ action, revokedSessions, newStatus: target.accountStatus });
      return res.json({ success: true, account: toSafeUser(target), revokedSessions });
    } catch (error) {
      await audit.fail({ error: "recovery-action-failed" });
      throw error;
    }
  } catch (error) {
    console.error("ACCOUNT RECOVERY ERROR:", error);
    return res.status(500).json({ success: false, error: "The recovery action could not be completed" });
  }
};

export const exportCompanyData = async (req, res) => {
  const { reason } = req.body;
  if (!validReason(reason)) return res.status(400).json({ success: false, error: "Provide a reason of at least 8 characters" });
  const actor = safeActor(req.user);
  let audit;
  try {
    audit = await beginSecurityAction({ actor, action: "company.data-export", reason, details: { format: "json" } });
    const companyId = actor.companyId;
    const [company, users, employees, departments, locations, attendance, salaries, leaves] = await Promise.all([
      Company.findById(companyId).lean(),
      User.find({ companyId, accountType: { $ne: "super_user" } }).select("-password -clerkUserId -profileImagePublicId -clerkUserCreatedByEMS -__v").lean(),
      Employee.find({ companyId }).lean(),
      Department.find({ companyId }).lean(),
      WorkLocation.find({ companyId }).lean(),
      Attendance.find({ companyId }).lean(),
      Salary.find({ companyId }).lean(),
      Leave.find({ companyId }).lean(),
    ]);
    const payload = { exportedAt: new Date().toISOString(), company, users, employees, departments, locations, attendance, salaries, leaves };
    if (JSON.stringify(payload).length > 50 * 1024 * 1024) {
      throw new Error("Company export exceeds the 50 MB safety limit");
    }
    const counts = Object.fromEntries(Object.entries(payload).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]));
    await audit.succeed({ counts });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="company-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json(payload);
  } catch (error) {
    if (audit) {
      try {
        await audit.fail({ error: "export-failed" });
      } catch (auditError) {
        console.error("COMPANY EXPORT FAILURE AUDIT ERROR:", auditError);
      }
    }
    console.error("COMPANY EXPORT ERROR:", error);
    return res.status(500).json({ success: false, error: "The company export could not be completed" });
  }
};

export const identifySuperUser = (req, res) => {
  if (!isSuperUser(req.user)) return res.status(403).json({ success: false });
  return res.json({ success: true, accountType: "super_user" });
};
