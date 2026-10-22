import { clerkClient, getAuth } from "@clerk/express";
import User from "../models/User.js";

// Links a Clerk login to an existing EMS record that was created by email (for
// example by the Managing Director) and has no Clerk ID yet. Only a verified
// primary email can link, and an already-linked record is never reassigned.
const linkClerkUserByEmail = async (clerkUserId) => {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);

  const primaryEmail = clerkUser.emailAddresses.find(
    (address) => address.id === clerkUser.primaryEmailAddressId
  );

  if (
    !primaryEmail ||
    primaryEmail.verification?.status !== "verified"
  ) {
    return null;
  }

  const user = await User.findOneAndUpdate(
    {
      email: primaryEmail.emailAddress.trim().toLowerCase(),
      clerkUserId: null,
    },
    { $set: { clerkUserId } },
    { new: true }
  ).select("-password");

  return user;
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