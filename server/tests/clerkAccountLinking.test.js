import test from "node:test";
import assert from "node:assert/strict";

import { linkClerkUserByVerifiedEmail } from "../middleware/authMiddleware.js";

const createUserModel = (user) => ({
  findOne(filter) {
    if (filter.clerkUserId === undefined) {
      const emailMatches = filter.$or?.some(
        (condition) =>
          (condition.email && condition.email === user.email) ||
          (condition.personalEmail && condition.personalEmail === user.personalEmail)
      );
      return {
        select: async () => (emailMatches ? user : null),
      };
    }

    const emailMatches = filter.$or?.some(
      (condition) =>
        (condition.email && condition.email === user.email) ||
        (condition.personalEmail && condition.personalEmail === user.personalEmail)
    );
    const clerkIdMatches =
      filter.clerkUserId?.$in?.includes(user.clerkUserId ?? null) ||
      filter.clerkUserId === user.clerkUserId;
    const found =
      (emailMatches || (filter.email && filter.email === user.email)) &&
      clerkIdMatches
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
    const emailMatches = filter.$or?.some(
      (condition) =>
        (condition.email && condition.email === user.email) ||
        (condition.personalEmail && condition.personalEmail === user.personalEmail)
    );
    const found =
      (emailMatches || (filter.email && filter.email === user.email)) &&
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

test("relinks an existing EMS account to a verified identity from another Clerk instance", async () => {
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

test("links a verified personal email to its matching EMS account", async () => {
  const user = {
    _id: "ems_user_1",
    email: "employee@nilric.co.tz",
    personalEmail: "employee@gmail.com",
    clerkUserId: null,
  };

  const linked = await linkClerkUserByVerifiedEmail(
    "clerk_personal_email_456",
    clerkUser({ email: "Employee@Gmail.com" }),
    createUserModel(user)
  );

  assert.equal(linked, user);
  assert.equal(user.clerkUserId, "clerk_personal_email_456");
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

test("does not link an email that does not match an EMS record", async () => {
  const user = {
    _id: "ems_user_1",
    email: "employee@nilric.co.tz",
    clerkUserId: null,
  };

  const linked = await linkClerkUserByVerifiedEmail(
    "clerk_production_456",
    clerkUser({ email: "another-person@nilric.co.tz" }),
    createUserModel(user)
  );

  assert.equal(linked, null);
  assert.equal(user.clerkUserId, null);
});

test("does not overwrite an existing Clerk link during conditional relinking", async () => {
  const user = {
    _id: "ems_user_1",
    email: "employee@nilric.co.tz",
    clerkUserId: "clerk_development_123",
  };
  const UserModel = createUserModel(user);
  UserModel.findOneAndUpdate = (filter) => {
    assert.equal(filter.clerkUserId, "clerk_development_123");
    user.clerkUserId = "clerk_another_session_789";
    return { select: async () => null };
  };

  const linked = await linkClerkUserByVerifiedEmail(
    "clerk_production_456",
    clerkUser({ email: "employee@nilric.co.tz" }),
    UserModel
  );

  assert.equal(linked, null);
  assert.equal(user.clerkUserId, "clerk_another_session_789");
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
