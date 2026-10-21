import test from "node:test";
import assert from "node:assert/strict";

import {
  ROLES,
  assignableRoles,
  canManageRole,
  getRole,
  hasCapability,
  isDepartmentScoped,
  isValidRole,
  roleLevel,
  CAPABILITIES,
} from "../utils/roles.js";

test("matches the Nilric organisation chart levels", () => {
  assert.equal(roleLevel("managing_director"), 100);
  assert.equal(roleLevel("general_manager"), 95);
  assert.equal(roleLevel("operations_manager"), 90);
  assert.equal(roleLevel("qshe_officer"), 85);
  assert.equal(roleLevel("department_manager"), 80);
  assert.equal(roleLevel("team_lead"), 60);
  assert.equal(roleLevel("employee"), 10);
});

test("legacy accounts keep their access", () => {
  assert.equal(getRole("admin")?.key, "managing_director");
  assert.equal(getRole("manager")?.key, "department_manager");
  assert.equal(getRole("tl")?.key, "team_lead");
  assert.equal(isValidRole("hr"), true);
  assert.equal(isValidRole("wizard"), false);
});

test("management roles can only manage roles below them", () => {
  assert.equal(canManageRole("managing_director", "general_manager"), true);
  assert.equal(canManageRole("general_manager", "department_manager"), true);
  assert.equal(canManageRole("department_manager", "team_lead"), true);
  assert.equal(canManageRole("team_lead", "employee"), true);
  assert.equal(canManageRole("department_manager", "department_manager"), false);
  assert.equal(canManageRole("employee", "team_lead"), false);
});

test("capabilities follow the org chart responsibilities", () => {
  assert.equal(
    hasCapability("managing_director", CAPABILITIES.SALARIES_MANAGE),
    true
  );
  assert.equal(
    hasCapability("team_lead", CAPABILITIES.SALARIES_MANAGE),
    false
  );
  assert.equal(
    hasCapability("qshe_officer", CAPABILITIES.ATTENDANCE_VIEW),
    true
  );
  assert.equal(
    hasCapability("qshe_officer", CAPABILITIES.ATTENDANCE_MANAGE),
    false
  );
  assert.equal(
    hasCapability("employee", CAPABILITIES.LEAVES_APPLY),
    true
  );
  assert.equal(
    hasCapability("managing_director", CAPABILITIES.LEAVES_APPLY),
    false
  );
});

test("department managers are scoped to their department", () => {
  assert.equal(isDepartmentScoped("department_manager"), true);
  assert.equal(isDepartmentScoped("team_lead"), true);
  assert.equal(isDepartmentScoped("general_manager"), false);
  assert.equal(isDepartmentScoped("employee"), false);
});

test("assignable roles exclude the actor's own level", () => {
  const roles = assignableRoles("general_manager");

  assert.ok(roles.includes("operations_manager"));
  assert.ok(roles.includes("department_manager"));
  assert.ok(roles.includes("employee"));
  assert.ok(!roles.includes("managing_director"));
  assert.ok(!roles.includes("general_manager"));
});

test("role catalogue is internally consistent", () => {
  for (const role of Object.values(ROLES)) {
    assert.equal(typeof role.label, "string");
    assert.ok(role.level > 0);
    assert.ok(Array.isArray(role.capabilities));
  }
});
