import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import Company from "../models/Company.js";
import SecurityAuditHead from "../models/SecurityAuditHead.js";
import User from "../models/User.js";
import { appendSecurityEvent } from "./securityAudit.js";

export class SuperUserProvisioningError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "SuperUserProvisioningError";
    this.statusCode = statusCode;
  }
}

export const provisionSuperUserAccount = async ({
  companyId,
  clerkUserId,
  clerkUser,
  reason,
  models = {},
}) => {
  const CompanyModel = models.CompanyModel || Company;
  const UserModel = models.UserModel || User;
  const AuditHeadModel = models.AuditHeadModel || SecurityAuditHead;
  const normalizedCompanyId = String(companyId || "").toLowerCase();
  const verifiedPrimaryEmail = clerkUser?.emailAddresses?.find(
    (address) =>
      address.id === clerkUser.primaryEmailAddressId &&
      address.verification?.status === "verified"
  );

  if (!mongoose.isValidObjectId(normalizedCompanyId)) {
    throw new SuperUserProvisioningError("A valid company is required");
  }
  if (!/^user_[A-Za-z0-9]+$/.test(String(clerkUserId || ""))) {
    throw new SuperUserProvisioningError("A valid Clerk user ID is required");
  }
  if (!verifiedPrimaryEmail) {
    throw new SuperUserProvisioningError("The Clerk account must have a verified primary email");
  }
  if (typeof reason !== "string" || reason.trim().length < 8 || reason.trim().length > 500) {
    throw new SuperUserProvisioningError("Provide a provisioning reason of 8 to 500 characters");
  }

  const company = await CompanyModel.findById(normalizedCompanyId)
    .select("_id name")
    .lean();
  if (!company) throw new SuperUserProvisioningError("Company not found", 404);

  const email = verifiedPrimaryEmail.emailAddress.trim().toLowerCase();
  const [existingSuperUser, existingEmail, existingClerkIdentity] = await Promise.all([
    UserModel.findOne({ companyId: company._id, accountType: "super_user" }).select("_id").lean(),
    UserModel.findOne({ $or: [{ email }, { personalEmail: email }] }).select("_id").lean(),
    UserModel.findOne({ clerkUserId }).select("_id").lean(),
  ]);
  if (existingSuperUser) {
    throw new SuperUserProvisioningError("This company already has a super-user", 409);
  }
  if (existingEmail || existingClerkIdentity) {
    throw new SuperUserProvisioningError("This email or login is already linked to an EMS account", 409);
  }
  const employeeAccount = await UserModel.findOne({
    companyId: company._id,
    role: "managing_director",
    accountType: { $ne: "super_user" },
  }).select("_id").lean();
  if (!employeeAccount) {
    throw new SuperUserProvisioningError("The company must have an active Managing Director account", 409);
  }

  const userId = new mongoose.Types.ObjectId();
  const claimToken = randomUUID();
  const now = new Date();
  let claim;
  try {
    const initialized = await AuditHeadModel.findOneAndUpdate(
      { companyId: company._id },
      { $setOnInsert: { sequence: 0, digest: "", superUserId: null } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (!initialized) throw new Error("Unable to initialize super-user claim");
    claim = await AuditHeadModel.findOneAndUpdate(
      {
        companyId: company._id,
        superUserId: null,
        $or: [
          { superUserClaimExpiresAt: { $exists: false } },
          { superUserClaimExpiresAt: null },
          { superUserClaimExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          superUserClaimToken: claimToken,
          superUserClaimExpiresAt: new Date(now.getTime() + 60_000),
        },
      },
      { new: true }
    );
  } catch (error) {
    if (error?.code === 11000) {
      throw new SuperUserProvisioningError("This company already has a super-user", 409);
    }
    throw error;
  }
  if (!claim) {
    throw new SuperUserProvisioningError("This company already has a super-user", 409);
  }

  let user;
  try {
    const reserved = await AuditHeadModel.findOneAndUpdate(
      { _id: claim._id, superUserId: null, superUserClaimToken: claimToken },
      {
        $set: { superUserId: userId },
        $unset: { superUserClaimToken: "", superUserClaimExpiresAt: "" },
      },
      { new: true }
    );
    if (!reserved) {
      throw new SuperUserProvisioningError("Super-user provisioning claim expired; retry the operation", 409);
    }

    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || "Company Super User";
    user = await UserModel.create({
      _id: userId,
      clerkUserId,
      name,
      username: `super-${userId.toString().slice(-10)}`,
      email,
      role: "managing_director",
      designation: "Company Super User",
      companyId: company._id,
      accountType: "super_user",
      accountStatus: "active",
      companyScope: true,
    });

    await appendSecurityEvent({
      actor: { _id: user._id, name: user.name, companyId: company._id },
      action: "super-user.provisioned",
      target: user,
      reason: reason.trim(),
      outcome: "success",
      details: { employeeRecordCreated: false, company: company.name },
    });
    return { company, user };
  } catch (error) {
    if (user) await UserModel.deleteOne({ _id: userId, accountType: "super_user" });
    await AuditHeadModel.updateOne(
      { _id: claim._id, superUserId: userId },
      { $set: { superUserId: null } }
    );
    await AuditHeadModel.updateOne(
      { _id: claim._id, superUserClaimToken: claimToken },
      { $unset: { superUserClaimToken: "", superUserClaimExpiresAt: "" } }
    );
    if (error?.code === 11000) {
      throw new SuperUserProvisioningError("This company already has a super-user", 409);
    }
    throw error;
  }
};
