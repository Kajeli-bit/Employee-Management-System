import test from "node:test";
import assert from "node:assert/strict";

import { canAdministerCompany, isSuperUser, requireSecurityOversight, requireSuperUser } from "../middleware/superUser.js";
import { employeeDirectoryUserFilter, employeeScopeFilter, hasCompanyScope, visibleRoleKeys } from "../utils/access.js";
import { CAPABILITIES, canManageRole, hasUserCapability, isManagementUser } from "../utils/roles.js";
import { enforceAuthenticatedUser } from "../middleware/authMiddleware.js";
import { appendSecurityEvent, beginSecurityAction, verifyAuditChain } from "../utils/securityAudit.js";

const companyId = "65d4a3f9c2748f35a7ec0011";
const superUser = { _id: "65d4a3f9c2748f35a7ec0022", companyId, name: "Security Operator", role: "managing_director", accountType: "super_user", companyScope: true };
const md = { _id: "65d4a3f9c2748f35a7ec0033", companyId, name: "Managing Director", role: "managing_director", accountType: "employee" };
const worker = { _id: "65d4a3f9c2748f35a7ec0044", companyId, name: "Worker", role: "worker", accountType: "employee" };

test("super-user is intentionally outside employee-role capability checks", () => {
  assert.equal(isSuperUser(superUser), true);
  assert.equal(isManagementUser(superUser), true);
  assert.equal(hasCompanyScope(superUser), true);
  assert.equal(canAdministerCompany(superUser), true);
  assert.equal(hasUserCapability(superUser, CAPABILITIES.PEOPLE_MANAGE), true);
  assert.equal(isSuperUser(md), false);
  assert.equal(isManagementUser(worker), false);
});

test("company-scoped super-user sees employee roles but stays out of the employee directory", () => {
  const filter = employeeDirectoryUserFilter(superUser);
  assert.equal(filter.accountType.$ne, "super_user");
  assert.equal(filter.companyId, superUser.companyId);
  assert.ok(!filter.$or[1]._id.equals?.(superUser._id) || filter.accountType.$ne === "super_user");
  assert.deepEqual(employeeScopeFilter(superUser, null), { companyId: superUser.companyId });
  assert.ok(visibleRoleKeys(superUser).includes("worker"));
  assert.ok(visibleRoleKeys(superUser).includes("hr"));
});

test("authenticated super-user can reach company routes but not unrelated APIs, and suspension still applies", () => {
  const invoke = (user, originalUrl) => {
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    let nextCalled = false;
    enforceAuthenticatedUser({ user, originalUrl }, response, () => { nextCalled = true; });
    return { response, nextCalled };
  };

  assert.equal(invoke(superUser, "/api/auth/verify").nextCalled, true);
  assert.equal(invoke(superUser, "/api/super-user/overview").nextCalled, true);
  for (const path of [
    "/api/dashboard",
    "/api/employee",
    "/api/department",
    "/api/salary",
    "/api/leave",
    "/api/attendance",
    "/api/locations",
    "/api/org/structure",
  ]) {
    assert.equal(invoke(superUser, path).nextCalled, true, `${path} should be available to the company operator`);
  }
  for (const path of ["/api/users", "/api/company-settings", "/api/super-userish/overview"]) {
    const blocked = invoke(superUser, path);
    assert.equal(blocked.response.statusCode, 403, `${path} should remain outside the allowlist`);
    assert.equal(blocked.nextCalled, false);
  }
  assert.equal(invoke({ ...superUser, role: "worker" }, "/api/super-user/me").response.body.code, "SUPER_USER_CONFIGURATION_INVALID");
  assert.equal(invoke({ ...md, accountStatus: "suspended" }, "/api/employee").response.body.code, "ACCOUNT_SUSPENDED");
});

test("restricted security middleware rejects regular employees", () => {
  const invoke = (middleware, user) => {
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    let nextCalled = false;
    middleware({ user }, response, () => { nextCalled = true; });
    return { response, nextCalled };
  };

  assert.equal(invoke(requireSuperUser, superUser).nextCalled, true);
  assert.equal(invoke(requireSecurityOversight, superUser).nextCalled, true);
  const denied = invoke(requireSuperUser, md);
  assert.equal(denied.response.statusCode, 403);
  assert.equal(denied.nextCalled, false);
  assert.equal(invoke(requireSecurityOversight, worker).response.statusCode, 403);
});

test("only super-users receive the added company-management capabilities", () => {
  for (const capability of [
    CAPABILITIES.PEOPLE_MANAGE,
    CAPABILITIES.SALARIES_VIEW,
    CAPABILITIES.ATTENDANCE_MANAGE,
    CAPABILITIES.LEAVES_VIEW,
  ]) {
    assert.equal(hasUserCapability(superUser, capability), true);
  }
  assert.equal(hasUserCapability(md, CAPABILITIES.PEOPLE_MANAGE), true);
  assert.equal(hasUserCapability(worker, CAPABILITIES.PEOPLE_MANAGE), false);
  assert.equal(canManageRole(superUser.role, "hr"), true);
  assert.equal(canManageRole(superUser.role, "managing_director"), false, "super-user must not create another Managing Director");
});

test("audit operations require a nonblank reason", async () => {
  await assert.rejects(
    appendSecurityEvent({ actor: superUser, action: "test", reason: "  ", outcome: "success" }),
    /reason is required/i
  );
  await assert.rejects(
    beginSecurityAction({ actor: superUser, action: "test", reason: "", details: {} }),
    /reason is required/i
  );
});

test("audit verification rejects a modified event, missing event, or mismatched head", () => {
  assert.equal(verifyAuditChain([], { sequence: 0, digest: "" }), true);
  assert.equal(verifyAuditChain([], { sequence: 1, digest: "tampered" }), false);
  assert.equal(verifyAuditChain([{ sequence: 2, previousDigest: "", digest: "anything" }], null), false);
});
