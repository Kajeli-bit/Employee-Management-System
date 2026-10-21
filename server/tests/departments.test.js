import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import Department from "../models/Department.js";
import {
  addDepartment,
  getDepartment,
} from "../controllers/departmentController.js";
import { getDashboard } from "../controllers/dashboardController.js";

import {
  clearTestDb,
  connectTestDb,
  createReq,
  createRes,
  disconnectTestDb,
} from "./helpers/harness.js";

import { makeStaff, seedOrganisation } from "./helpers/fixtures.js";

before(async () => {
  await connectTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

after(async () => {
  await disconnectTestDb();
});

const call = async (controller, request) => {
  const res = createRes();

  await controller(request, res);

  return res;
};

test("registers a department together with its teams", async () => {
  const { company, head } = await seedOrganisation();

  const res = await call(
    addDepartment,
    createReq({
      user: head,
      body: {
        dep_name: "Logistics",
        description: "Supply chain and transport",
        teams: ["Fleet Team", "Warehouse Team"],
      },
    })
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.department.dep_name, "Logistics");
  assert.equal(res.body.teams.length, 2);

  for (const team of res.body.teams) {
    assert.equal(team.kind, "team");
    assert.equal(team.parent.toString(), res.body.department._id.toString());
  }

  const stored = await Department.findOne({
    companyId: company._id,
    dep_name: "Fleet Team",
  });

  assert.ok(stored, "team is persisted");
  assert.equal(stored.parent.toString(), res.body.department._id.toString());
});

test("bad team lists fail without saving anything", async () => {
  const { company, head } = await seedOrganisation();
  const before = await Department.countDocuments({ companyId: company._id });

  const duplicate = await call(
    addDepartment,
    createReq({
      user: head,
      body: { dep_name: "Logistics", teams: ["Fleet Team", "Fleet Team"] },
    })
  );

  assert.equal(duplicate.statusCode, 400);

  const blank = await call(
    addDepartment,
    createReq({
      user: head,
      body: { dep_name: "Logistics", teams: ["  "] },
    })
  );

  assert.equal(blank.statusCode, 400);

  const clash = await call(
    addDepartment,
    createReq({
      user: head,
      body: { dep_name: "Logistics", teams: ["Finance Team"] },
    })
  );

  assert.equal(clash.statusCode, 400);

  assert.equal(
    await Department.countDocuments({ companyId: company._id }),
    before,
    "no department or team is stored on validation failure"
  );
});

test("getDepartment returns its teams", async () => {
  const { head } = await seedOrganisation();

  const created = await call(
    addDepartment,
    createReq({
      user: head,
      body: { dep_name: "Logistics", teams: ["Fleet Team"] },
    })
  );

  assert.equal(created.statusCode, 201);

  const res = await call(
    getDepartment,
    createReq({ user: head, params: { id: created.body.department._id } })
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.teams.length, 1);
  assert.equal(res.body.teams[0].dep_name, "Fleet Team");
});

test("getDepartment reports employee counts", async () => {
  const { company, head, finance, financeTeam } = await seedOrganisation();

  await makeStaff({
    companyId: company._id,
    department: financeTeam._id,
    createdBy: head._id,
    name: "Team member",
    employeeId: "EMP-T1",
  });

  const res = await call(
    getDepartment,
    createReq({ user: head, params: { id: finance._id } })
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.department.employeeCount, 0);
  assert.equal(res.body.teams.length, 1);
  assert.equal(res.body.teams[0].employeeCount, 1);
});

test("dashboard counts departments, not teams", async () => {
  const { head } = await seedOrganisation();

  const created = await call(
    addDepartment,
    createReq({
      user: head,
      body: { dep_name: "Logistics", teams: ["Fleet Team"] },
    })
  );

  assert.equal(created.statusCode, 201);

  const res = await call(getDashboard, createReq({ user: head }));

  assert.equal(res.statusCode, 200);
  // Finance + Operations from the seed plus Logistics; the Finance Team
  // and Fleet Team must not be counted.
  assert.equal(res.body.dashboard.totalDepartments, 3);
});
