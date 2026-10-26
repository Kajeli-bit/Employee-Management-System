import { clerkClient, getAuth } from "@clerk/express";
import User from "../models/User.js";

// Connect an authenticated Clerk identity to an existing EMS account using
// the verified primary email. The Clerk ID can differ between the local
// development instance and production, especially for records copied from
// `test` into `ems`.
export const linkClerkUserByVerifiedEmail = async (
  clerkUserId,
  clerkUser,
  UserModel = User
) => {
  const signInEmail = clerkUser?.emailAddresses?.find(
    (address) =>
      address.id === clerkUser.primaryEmailAddressId &&
      address.verification?.status === "verified"
  );

  if (!signInEmail) {
    return null;
  }

  const email = signInEmail.emailAddress.trim().toLowerCase();
  const existingQuery = UserModel.findOne({
    $or: [{ email }, { personalEmail: email }],
  });
  const existingUser = await existingQuery.select("-password");

  if (!existingUser) {
    return null;
  }

  if (existingUser.clerkUserId === clerkUserId) {
    return existingUser;
  }

  // Match the ID we just read so a simultaneous account change cannot be
  // overwritten. `$in: [null]` matches either a null or absent Clerk ID.
  const previousClerkUserId = existingUser.clerkUserId;

  const filter = {
    _id: existingUser._id,
    $or: [{ email }, { personalEmail: email }],
    clerkUserId:
      previousClerkUserId == null
        ? { $in: [null] }
        : previousClerkUserId,
  };
  const updateQuery = UserModel.findOneAndUpdate(
    filter,
    { $set: { clerkUserId } },
    { new: true }
  );
  const linkedUser = await updateQuery.select("-password");

  if (linkedUser) {
    return linkedUser;
  }

  // Another request may have completed the same verified-email relink first.
  const concurrentQuery = UserModel.findOne({ clerkUserId });
  return concurrentQuery.select("-password");
};

const linkClerkUserByEmail = async (clerkUserId) => {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  return linkClerkUserByVerifiedEmail(clerkUserId, clerkUser);
};

const verifyUser = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    let user = await User.findOne({
      clerkUserId: userId,
    }).select("-password");

    if (!user) {
      user = await linkClerkUserByEmail(userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "EMS user account not registered",
        code: "EMS_USER_NOT_FOUND",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.log("CLERK AUTH MIDDLEWARE ERROR:", error);

    return res.status(401).json({
      success: false,
      error: "Authentication failed",
    });
  }
};

export default verifyUser;
