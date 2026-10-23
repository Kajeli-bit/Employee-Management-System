import test from "node:test";
import assert from "node:assert/strict";

import {
  ROLES,
  ROLE_KEYS,
  assignableRoles,
  canManageRole,
  getRole,
  hasCapability,
  isManagementRole,
  isValidRole,
  roleFilterAliases,
  roleLevel,
  CAPABILITIES,
} from "../utils/roles.js";

test("the access model has exactly three roles", () => {
  assert.deepEqual(ROLE_KEYS.sort(), ["hr", "managing_director", "worker"]);
  assert.equal(roleLevel("managing_director"), 100);
  assert.equal(roleLevel("hr"), 90);
  assert.equal(roleLevel("worker"), 10);
});

test("retired roles resolve to their closest new role", () => {
  // The old chart's management roles move under HR.
  assert.equal(getRole("admin")?.key, "managing_director");
  assert.equal(getRole("general_manager")?.key, "hr");
  assert.equal(getRole("operations_manager")?.key, "hr");
  assert.equal(getRole("department_manager")?.key, "hr");
  assert.equal(getRole("manager")?.key, "hr");

  // Team-level roles become workers.
  assert.equal(getRole("team_lead")?.key, "worker");
  assert.equal(getRole("tl")?.key, "worker");
  assert.equal(getRole("employee")?.key, "worker");
  assert.equal(getRole("qshe_officer")?.key, "worker");

  assert.equal(isValidRole("wizard"), false);
});

test("the Managing Director outranks HR, which outranks workers", () => {
  assert.equal(canManageRole("managing_director", "hr"), true);
  assert.equal(canManageRole("managing_director", "worker"), true);
  assert.equal(canManageRole("hr", "worker"), true);

  // HR cannot appoint or edit another HR without the MD.
  assert.equal(canManageRole("hr", "hr"), false);
  assert.equal(canManageRole("hr", "managing_director"), false);
  assert.equal(canManageRole("worker", "worker"), false);
  assert.equal(canManageRole("worker", "hr"), false);
});

test("capabilities separate the office from the floor", () => {
  for (const officeRole of ["managing_director", "hr"]) {
    assert.equal(hasCapability(officeRole, CAPABILITIES.PEOPLE_MANAGE), true);
    assert.equal(hasCapability(officeRole, CAPABILITIES.SALARIES_MANAGE), true);
    assert.equal(hasCapability(officeRole, CAPABILITIES.LEAVES_APPROVE), true);
    assert.equal(hasCapability(officeRole, CAPABILITIES.SETTINGS_MANAGE), true);
    // Both may use the worker portal.
    assert.equal(hasCapability(officeRole, CAPABILITIES.LEAVES_APPLY), true);
    assert.equal(hasCapability(officeRole, CAPABILITIES.ATTENDANCE_SELF), true);
  }

  assert.equal(hasCapability("worker", CAPABILITIES.LEAVES_APPLY), true);
  assert.equal(hasCapability("worker", CAPABILITIES.ATTENDANCE_SELF), true);
  assert.equal(hasCapability("worker", CAPABILITIES.ORG_VIEW), true);

  assert.equal(hasCapability("worker", CAPABILITIES.PEOPLE_VIEW), false);
  assert.equal(hasCapability("worker", CAPABILITIES.PEOPLE_MANAGE), false);
  assert.equal(hasCapability("worker", CAPABILITIES.SALARIES_VIEW), false);
  assert.equal(hasCapability("worker", CAPABILITIES.ATTENDANCE_VIEW), false);
  assert.equal(hasCapability("worker", CAPABILITIES.LEAVES_APPROVE), false);
});

test("only MD and HR run the management console", () => {
  assert.equal(isManagementRole("managing_director"), true);
  assert.equal(isManagementRole("hr"), true);
  assert.equal(isManagementRole("worker"), false);
  assert.equal(isManagementRole("department_manager"), true, "legacy alias");
  assert.equal(isManagementRole("team_lead"), false, "team leads are workers");
});

test("filtering by a role also matches its retired keys", () => {
  const hr = roleFilterAliases("hr");

  assert.ok(hr.includes("hr"));
  assert.ok(hr.includes("department_manager"));
  assert.ok(hr.includes("general_manager"));
  assert.ok(!hr.includes("worker"));

  const worker = roleFilterAliases("worker");

  assert.ok(worker.includes("worker"));
  assert.ok(worker.includes("team_lead"));
  assert.ok(!worker.includes("hr"));

  assert.deepEqual(roleFilterAliases("wizard"), []);
});

test("assignable roles follow the hierarchy", () => {
  const md = assignableRoles("managing_director");

  assert.deepEqual(md.sort(), ["hr", "worker"]);

  assert.deepEqual(assignableRoles("hr"), ["worker"]);
  assert.deepEqual(assignableRoles("worker"), []);
});

test("role catalogue is internally consistent", () => {
  const catalog = Object.values(ROLES);

  assert.equal(catalog.length, 3);

  for (const role of catalog) {
    assert.equal(typeof role.label, "string");
    assert.ok(role.level > 0);
    assert.ok(["company", "department", "team", "self"].includes(role.scope));
    assert.ok(Array.isArray(role.capabilities));
  }
});
