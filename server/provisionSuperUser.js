import "dotenv/config";
import connectToDatabase from "./db/db.js";
import mongoose from "mongoose";
import { clerkClient } from "@clerk/express";
import { provisionSuperUserAccount } from "./utils/superUserProvisioning.js";

const [clerkUserId, reason = "Initial company super-user provisioning"] = process.argv.slice(2);
const companyId = process.env.SUPER_USER_COMPANY_ID;

if (!companyId || !clerkUserId || !/^user_[A-Za-z0-9]+$/.test(clerkUserId) || reason.trim().length < 8) {
  console.error("Usage: SUPER_USER_COMPANY_ID=<company-id> npm run provision:super-user -- <clerk-user-id> [reason]");
  process.exitCode = 2;
} else {
  try {
    await connectToDatabase();
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const { company, user } = await provisionSuperUserAccount({
      companyId,
      clerkUserId,
      clerkUser,
      reason,
    });
    console.log(`Provisioned company super-user for ${company.name} (${user.email}).`);
    console.log("No employee record was created. The account is available in the restricted security center.");
  } catch (error) {
    console.error("Super-user provisioning failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
