import test from "node:test";
import assert from "node:assert/strict";

import { linkClerkUserByVerifiedEmail } from "../middleware/authMiddleware.js";

const createUserModel = (user) => ({
  findOne(filter) {
    const found =
      filter.email === user.email || filter.clerkUserId === user.clerkUserId
        ? user
        : null;

    return {
      select: async () => found,
    };
  },
  findOneAndUpdate(filter, update) {
    const idMatches =
      filter.clerkUserId?.$in?.includes(user.clerkUserId ?? null) ||
      filter.clerkUserId === user.clerkUserId;
    const found =
      filter.email === user.email &&
      filter._id === user._id &&
      idMatches
        ? user
        : null;

    if (found) {
      Object.assign(user, update.$set);
    }

    return {
      select: async () => found,
    };
  },
});

const clerkUser = ({ email, verified = true }) => ({
  primaryEmailAddressId: "email_1",
  emailAddresses: [
    {
      id: "email_1",
      emailAddress: email,
      verification: { status: verified ? "verified" : "unverified" },
    },
  ],
});

test("links an existing EMS account to a verified identity from another Clerk instance", async () => {
  const user = {
    _id: "ems_user_1",
    email: "employee@nilric.co.tz",
    clerkUserId: "clerk_development_123",
  };

  const linked = await linkClerkUserByVerifiedEmail(
    "clerk_production_456",
    clerkUser({ email: "Employee@Nilric.co.tz" }),
    createUserModel(user)
  );

  assert.equal(linked, user);
  assert.equal(user.clerkUserId, "clerk_production_456");
});

test("does not link an unverified Clerk email", async () => {
  const user = {
    _id: "ems_user_1",
    email: "employee@nilric.co.tz",
    clerkUserId: "clerk_development_123",
  };

  const linked = await linkClerkUserByVerifiedEmail(
    "clerk_production_456",
    clerkUser({ email: "employee@nilric.co.tz", verified: false }),
    createUserModel(user)
  );

  assert.equal(linked, null);
  assert.equal(user.clerkUserId, "clerk_development_123");
});

test("does not reassign an EMS record when the verified email does not match", async () => {
  const user = {
    _id: "ems_user_1",
    email: "employee@nilric.co.tz",
    clerkUserId: "clerk_development_123",
  };

  const linked = await linkClerkUserByVerifiedEmail(
    "clerk_production_456",
    clerkUser({ email: "another-person@nilric.co.tz" }),
    createUserModel(user)
  );

  assert.equal(linked, null);
  assert.equal(user.clerkUserId, "clerk_development_123");
});

test("preserves the current Clerk ID when the same identity verifies again", async () => {
  const user = {
    _id: "ems_user_1",
    email: "employee@nilric.co.tz",
    clerkUserId: "clerk_production_456",
  };

  const linked = await linkClerkUserByVerifiedEmail(
    "clerk_production_456",
    clerkUser({ email: "employee@nilric.co.tz" }),
    createUserModel(user)
  );

  assert.equal(linked, user);
  assert.equal(user.clerkUserId, "clerk_production_456");
});
