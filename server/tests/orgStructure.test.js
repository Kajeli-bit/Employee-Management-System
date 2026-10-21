import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Company from "../models/Company.js";
import Department from "../models/Department.js";
import {
  NILRIC_DEPARTMENTS,
  seedCompanyDefaults,
  syncCompanyStructure,
} from "../utils/orgDefaults.js";

import {
  clearTestDb,
  connectTestDb,
  disconnectTestDb,
} from "./helpers/harness.js";

import { makeEmployee, makeUser } from "./helpers/fixtures.js";

before(async () => {
  await connectTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

after(async () => {
  await disconnectTestDb();
});

const makeCompany = async (name = "Test Company") => {
  const companyId = new mongoose.Types.ObjectId();
  const head = await makeUser({
    companyId,
    role: "managing_director",
    name: "Managing Director",
  });
  const company = await Company.create({
    _id: companyId,
    name,
    head: head._id,
  });

  return { company, head };
};

const departmentCount = (companyId, kind) =>
  Department.countDocuments({ companyId, kind });

test("a fresh company seeds six departments and eight teams", async () => {
  const { company, head } = await makeCompany();

  const { departments, primaryLocation } = await seedCompanyDefaults({
    companyId: company._id,
    createdBy: head._id,
  });

  assert.equal(await departmentCount(company._id, "department"), 6);
  assert.equal(await departmentCount(company._id, "team"), 8);
  assert.ok(primaryLocation, "head-office location is created");
  assert.equal(
    departments.administration_hr.dep_name,
    "Administration & Human Resource"
  );

  const engineering = await Department.findOne({
    companyId: company._id,
    key: "engineering",
  });

  assert.ok(engineering, "Engineering department exists");

  const teams = await Department.find({
    companyId: company._id,
    kind: "team",
    parent: engineering._id,
  })
    .select("dep_name")
    .lean();

  assert.deepEqual(
    teams.map((team) => team.dep_name).sort(),
    [
      "Civil Engineering Team",
      "Electrical & Telecommunication Team",
      "Mechanical Engineering Team",
    ]
  );
});

test("sync renames, reparents and prunes empty legacy units", async () => {
  const { company } = await makeCompany();

  const operations = await Department.create({
    companyId: company._id,
    dep_name: "Operations",
    kind: "department",
    key: "operations",
  });

  await Department.create({
    companyId: company._id,
    dep_name: "Quality, Safety, Health & Environment",
    kind: "department",
    key: "qshe",
  });

  const buildingCivil = await Department.create({
    companyId: company._id,
    dep_name: "Building & Civil Projects",
    kind: "department",
    key: "building_civil",
  });

  await Department.create({
    companyId: company._id,
    dep_name: "Civil Engineering Team",
    kind: "team",
    key: "civil_team",
    parent: buildingCivil._id,
  });

  await Department.create({
    companyId: company._id,
    dep_name: "Administration & Human Resources",
    kind: "department",
    key: "administration_hr",
  });

  await Department.create({
    companyId: company._id,
    dep_name: "Logistics",
    kind: "department",
  });

  const { departments, summary } = await syncCompanyStructure({
    companyId: company._id,
  });

  // Six defaults plus the custom Logistics department, which must survive.
  assert.equal(await departmentCount(company._id, "department"), 7);
  assert.equal(await departmentCount(company._id, "team"), 8);

  assert.equal(
    departments.administration_hr.dep_name,
    "Administration & Human Resource"
  );
  assert.ok(
    summary.renamed.some((entry) =>
      entry.includes("Administration & Human Resources")
    ),
    "rename is reported"
  );

  const civilTeam = await Department.findOne({
    companyId: company._id,
    key: "civil_team",
  });

  assert.equal(civilTeam.parent.toString(), departments.engineering._id.toString());
  assert.ok(
    summary.reparented.some((entry) => entry.includes("Civil Engineering Team")),
    "reparent is reported"
  );

  assert.equal(
    await Department.countDocuments({
      companyId: company._id,
      key: { $in: ["operations", "qshe", "building_civil"] },
    }),
    0,
    "empty legacy units are removed"
  );
  assert.ok(summary.removed.includes("Operations"));

  assert.ok(
    await Department.findOne({ companyId: company._id, dep_name: "Logistics" }),
    "custom keyless departments are kept"
  );

  assert.equal(
    NILRIC_DEPARTMENTS.length,
    6,
    "defaults under test are the six-department structure"
  );
});

test("sync keeps units that still hold employees", async () => {
  const { company, head } = await makeCompany();

  const operations = await Department.create({
    companyId: company._id,
    dep_name: "Operations",
    kind: "department",
    key: "operations",
  });

  const member = await makeUser({ companyId: company._id });
  await makeEmployee({
    companyId: company._id,
    user: member,
    department: operations._id,
    createdBy: head._id,
    employeeId: "EMP-0001",
  });

  const { summary } = await syncCompanyStructure({ companyId: company._id });

  assert.ok(
    await Department.findById(operations._id),
    "occupied unit is not deleted"
  );
  assert.ok(
    summary.kept.some((entry) => entry.includes("Operations")),
    "kept unit is reported"
  );
});
