import test from "node:test";
import assert from "node:assert/strict";

import {
  PROFILE_FIELDS,
  asBoolean,
  canGrantCompanyScope,
  employeeIdSeed,
  missingEmployeeEssentials,
  parseOptionalSalary,
  phoneIsUsable,
  readProfileFields,
  splitList,
  usernameFromEmail,
} from "../utils/employeeProfile.js";
import { ROLE_KEYS, publicRoleCatalog } from "../utils/roles.js";
import Employee from "../models/Employee.js";
import User from "../models/User.js";
import mongoose from "mongoose";

test("profile fields cover the onboarding details HR records", () => {
  for (const field of [
    "probationEndDate",
    "nhifNumber",
    "bankBranch",
    "drivingLicenceNumber",
    "passportNumber",
    "workPermitExpiry",
  ]) {
    assert.ok(
      PROFILE_FIELDS.includes(field),
      `${field} should be accepted on create and update`
    );
  }
});

test("readProfileFields keeps known fields and drops unknown ones", () => {
  const values = readProfileFields({
    phone: "+255712345678",
    bankBranch: "Samora Avenue",
    salary: "999999999",
    isAdmin: "true",
    role: "managing_director",
  });

  assert.equal(values.phone, "+255712345678");
  assert.equal(values.bankBranch, "Samora Avenue");
  assert.equal(values.salary, undefined);
  assert.equal(values.isAdmin, undefined);
  assert.equal(values.role, undefined);
});

test("an empty value clears the field instead of storing a blank string", () => {
  const values = readProfileFields({ nhifNumber: "", bankName: "NMB" });

  assert.equal(values.nhifNumber, undefined);
  assert.equal(values.bankName, "NMB");
});

test("lists and the emergency contact arrive in the stored shape", () => {
  const values = readProfileFields({
    certifications: "PMP, CCNA ,OSHA",
    skills: ["HVAC", " Welding "],
    "emergencyContact.name": " Neema Juma ",
    "emergencyContact.relationship": "Spouse",
    "emergencyContact.phone": "+255700000000",
  });

  assert.deepEqual(values.certifications, ["PMP", "CCNA", "OSHA"]);
  assert.deepEqual(values.skills, ["HVAC", "Welding"]);
  assert.deepEqual(values.emergencyContact, {
    name: "Neema Juma",
    relationship: "Spouse",
    phone: "+255700000000",
  });
});

test("splitList tolerates missing values", () => {
  assert.deepEqual(splitList(undefined), []);
  assert.deepEqual(splitList(""), []);
});

test("form booleans are parsed, not trusted as strings", () => {
  assert.equal(asBoolean("true"), true);
  assert.equal(asBoolean(true), true);
  assert.equal(asBoolean("false"), false);
  assert.equal(asBoolean(""), false);
  assert.equal(asBoolean(undefined, true), true);
});

test("only the office roles can grant company-wide visibility", () => {
  assert.equal(
    canGrantCompanyScope({ role: "managing_director", companyScope: false }),
    true
  );
  assert.equal(
    canGrantCompanyScope({ role: "hr", companyScope: false }),
    true
  );
  assert.equal(
    canGrantCompanyScope({ role: "worker", companyScope: false }),
    false
  );
  // A retired management key still resolves to HR.
  assert.equal(
    canGrantCompanyScope({ role: "department_manager", companyScope: false }),
    true
  );
  assert.equal(
    canGrantCompanyScope({ role: "team_lead", companyScope: false }),
    false
  );
});

test("onboarding requires only a name, work email and phone", () => {
  assert.deepEqual(
    missingEmployeeEssentials({
      name: " Amina Juma ",
      email: "amina@nilric.co.tz",
      phone: "+255 712 345 678",
    }),
    []
  );

  assert.deepEqual(
    missingEmployeeEssentials({ name: "", email: "", phone: "12" }),
    ["name", "email", "phone"]
  );

  // A phone that is only punctuation/spaces is not a phone number.
  assert.equal(phoneIsUsable("   - - "), false);
  assert.equal(phoneIsUsable("0712345678"), true);
});

test("a username is derived from the work email", () => {
  assert.equal(usernameFromEmail("Amina.Juma@nilric.co.tz"), "amina.juma");
  assert.equal(usernameFromEmail("john+site@nilric.co.tz"), "john.site");
  assert.equal(usernameFromEmail("  "), "worker");
});

test("a staff ID is generated when none is supplied", () => {
  assert.match(employeeIdSeed(new Date("2026-10-22")), /^NIL-26-\d{4}$/);
});

test("pay is optional but a bad amount is rejected", () => {
  assert.deepEqual(parseOptionalSalary(""), { value: undefined });
  assert.deepEqual(parseOptionalSalary("850000"), { value: 850000 });
  assert.ok(parseOptionalSalary("abc").error);
  assert.ok(parseOptionalSalary("-5").error);
});

test("a worker record can be created without department, pay or birth date", async () => {
  const companyId = new mongoose.Types.ObjectId();

  const user = new User({
    name: "Amina Juma",
    username: "amina.juma",
    email: "amina@nilric.co.tz",
    companyId,
  });

  await user.validate();

  assert.equal(user.role, "worker");
  assert.equal(user.designation, "");
  assert.equal(user.dob, undefined);

  const employee = new Employee({
    userId: user._id,
    companyId,
    createdBy: user._id,
    employeeId: "NIL-TEST-0002",
  });

  await employee.validate();

  assert.equal(employee.department, null);
  assert.equal(employee.salary, undefined);
});

test("the employee record accepts the new onboarding fields", async () => {
  const id = () => new mongoose.Types.ObjectId();

  const employee = new Employee({
    userId: id(),
    companyId: id(),
    createdBy: id(),
    employeeId: "NIL-TEST-0001",
    department: id(),
    salary: 500000,
    workLocation: id().toString(),
    probationEndDate: "2027-01-15",
    nhifNumber: "NHIF-1",
    bankBranch: "Samora Avenue",
    drivingLicenceNumber: "DL-1",
    passportNumber: "P-1",
    workPermitExpiry: "2027-06-30",
  });

  await employee.validate();

  assert.ok(employee.workLocation instanceof mongoose.Types.ObjectId);
  assert.equal(
    employee.probationEndDate.toISOString().slice(0, 10),
    "2027-01-15"
  );
  assert.equal(
    employee.workPermitExpiry.toISOString().slice(0, 10),
    "2027-06-30"
  );
  assert.equal(employee.nhifNumber, "NHIF-1");
  assert.equal(employee.bankBranch, "Samora Avenue");
  assert.equal(employee.drivingLicenceNumber, "DL-1");
  assert.equal(employee.passportNumber, "P-1");
});

test("the picker can render every role from the public catalogue", () => {
  const catalog = publicRoleCatalog();

  assert.equal(catalog.length, ROLE_KEYS.length);
  assert.equal(catalog.length, 3);

  for (const role of catalog) {
    assert.ok(role.key);
    assert.ok(role.label);
    assert.ok(role.tier, `${role.key} needs a tier for grouping`);
    assert.ok(role.scope, `${role.key} needs a scope for the access hint`);
    assert.equal(typeof role.description, "string");
    assert.ok(role.description.length > 0);
    assert.ok(Array.isArray(role.capabilities));
    assert.ok(role.level > 0);
  }
});
