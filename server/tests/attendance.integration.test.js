import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import Attendance from "../models/Attendance.js";
import { localDateKey } from "../utils/geo.js";

import {
  checkIn,
  checkOut,
  getAttendance,
  markAttendance,
} from "../controllers/attendanceController.js";

import {
  connectTestDb,
  createReq,
  createRes,
  disconnectTestDb,
  clearTestDb,
} from "./helpers/harness.js";

import {
  FAR_AWAY,
  HEAD_OFFICE,
  makeStaff,
  seedOrganisation,
} from "./helpers/fixtures.js";

before(async () => {
  await connectTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

after(async () => {
  await disconnectTestDb();
});

// Runs a controller the way Express would and returns the response double.
const call = async (controller, request) => {
  const res = createRes();

  await controller(request, res);

  return res;
};

const clockIn = (user, position = HEAD_OFFICE, accuracy = 10) =>
  call(checkIn, {
    user,
    body: { ...position, accuracy },
  });

const clockOut = (user, position = HEAD_OFFICE) =>
  call(checkOut, {
    user,
    body: { ...position, accuracy: 10 },
  });

const recordFor = (employee) =>
  Attendance.findOne({ employeeId: employee._id }).lean();

test("Saturday check-in uses the 09:00 start for its lateness calculation", async () => {
  const { company, finance, head } = await seedOrganisation();
  const { user } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  const realDate = globalThis.Date;
  globalThis.Date = class extends realDate {
    constructor(...args) {
      if (args.length === 0) {
        super("2026-10-24T06:00:00.000Z"); // 09:00 EAT, Saturday
      } else {
        super(...args);
      }
    }
    static now() {
      return new realDate("2026-10-24T06:00:00.000Z").getTime();
    }
  };

  let res;
  try {
    res = await clockIn(user);
  } finally {
    globalThis.Date = realDate;
  }

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.record.lateByMinutes, 0);
});

test("Sunday clock-in is rejected as a non-working day", async () => {
  const { company, finance, head } = await seedOrganisation();
  const { user, employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  const realDate = globalThis.Date;
  globalThis.Date = class extends realDate {
    constructor(...args) {
      if (args.length === 0) {
        super("2026-10-25T05:00:00.000Z"); // 08:00 EAT, Sunday
      } else {
        super(...args);
      }
    }
    static now() {
      return new realDate("2026-10-25T05:00:00.000Z").getTime();
    }
  };

  let res;
  try {
    res = await clockIn(user);
  } finally {
    globalThis.Date = realDate;
  }

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /Sunday.*non-working day/i);
  assert.equal(await Attendance.countDocuments({ employeeId: employee._id }), 0);
});

test("a fix inside the head office fence is accepted", async () => {
  const { company, finance, head } = await seedOrganisation();
  const { user } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  const res = await clockIn(user);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);

  const { record } = res.body;

  assert.equal(record.checkIn.withinGeofence, true);
  assert.equal(record.checkIn.locationName, "Nilric Head Office");
  assert.equal(record.source, "GPS");
  assert.ok(
    record.checkIn.distanceMeters < 250,
    `expected to be inside the 250 m fence, got ${record.checkIn.distanceMeters}`
  );

  // Late/half-day maths depends on the wall clock, so assert internal
  // consistency instead of a status that changes with the time of day.
  assert.equal(
    record.status,
    record.lateByMinutes > 0 ? "Late" : "Present"
  );
});

test("a fix 12 km away is rejected and stores nothing", async () => {
  const { company, finance, head } = await seedOrganisation();
  const { user, employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  const res = await clockIn(user, FAR_AWAY);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /work location/i);
  assert.ok(res.body.distanceMeters > 9000);
  assert.equal(res.body.locationName, "Nilric Head Office");

  const stored = await Attendance.countDocuments({ employeeId: employee._id });

  assert.equal(stored, 0, "a rejected punch must not create a record");
});

test("field staff may clock in away from the office, flagged as field", async () => {
  const { company, operations, head } = await seedOrganisation();
  const { user } = await makeStaff({
    companyId: company._id,
    department: operations._id,
    createdBy: head._id,
    role: "employee",
    workMode: "Field",
    employeeId: "EMP-FIELD-1",
  });

  const res = await clockIn(user, FAR_AWAY);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.record.source, "Field");
  assert.equal(res.body.record.checkIn.withinGeofence, false);
});

test("the same employee cannot clock in twice in one day", async () => {
  const { company, finance, head } = await seedOrganisation();
  const { user, employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  const first = await clockIn(user);
  const second = await clockIn(user);

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 409);
  assert.match(second.body.error, /already clocked in/i);

  assert.equal(await Attendance.countDocuments({ employeeId: employee._id }), 1);
});

test("clocking out without a check-in is rejected", async () => {
  const { company, finance, head } = await seedOrganisation();
  const { user } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  const res = await clockOut(user);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /not clocked in/i);
});

test("a day shorter than the threshold closes as a half day", async () => {
  const { company, finance, head } = await seedOrganisation();
  const { user, employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  await clockIn(user);

  // Move the punch to an hour ago so the worked minutes are deterministic.
  await Attendance.updateOne(
    { employeeId: employee._id },
    {
      $set: {
        "checkIn.at": new Date(Date.now() - 60 * 60 * 1000),
        status: "Present",
        lateByMinutes: 0,
      },
    }
  );

  const res = await clockOut(user);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.record.status, "Half Day");
  assert.ok(
    res.body.record.workedMinutes >= 60 &&
      res.body.record.workedMinutes < 61
  );
});

test("a full day stays present and cannot be closed twice", async () => {
  const { company, finance, head } = await seedOrganisation();
  const { user, employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  await clockIn(user);

  await Attendance.updateOne(
    { employeeId: employee._id },
    {
      $set: {
        "checkIn.at": new Date(Date.now() - 9 * 60 * 60 * 1000),
        status: "Present",
        lateByMinutes: 0,
      },
    }
  );

  const first = await clockOut(user);
  const second = await clockOut(user);

  assert.equal(first.statusCode, 200);
  assert.equal(first.body.record.status, "Present");
  assert.ok(first.body.record.workedMinutes >= 540);

  assert.equal(second.statusCode, 409);
  assert.match(second.body.error, /already clocked out/i);
});

test("clocking in replaces an absence a manager had recorded", async () => {
  const { company, finance, head } = await seedOrganisation();
  const manager = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
    role: "hr",
    name: "HR Manager",
    employeeId: "EMP-MGR-1",
  });
  const { user, employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: manager.user._id,
  });

  const today = localDateKey(new Date());

  const marked = await call(markAttendance, {
    user: manager.user,
    body: {
      employeeId: employee._id.toString(),
      date: today,
      status: "Absent",
      note: "No show at 10:00",
    },
  });

  assert.equal(marked.statusCode, 200);
  assert.equal(marked.body.record.status, "Absent");
  assert.equal(marked.body.record.source, "Manual");

  const res = await clockIn(user);

  assert.equal(res.statusCode, 201);
  assert.equal(
    res.body.record.status,
    res.body.record.lateByMinutes > 0 ? "Late" : "Present"
  );
  assert.equal(res.body.record.source, "GPS");
  assert.ok(res.body.record.checkIn.at);

  const stored = await recordFor(employee);

  assert.notEqual(stored.status, "Absent");
});

test("an exited employee cannot clock in", async () => {
  const { company, finance, head } = await seedOrganisation();
  const { user } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
    employmentStatus: "Exited",
  });

  const res = await clockIn(user);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /Exited/);
});

test("HR sees every department and can narrow the register by query", async () => {
  const { company, finance, operations, head } = await seedOrganisation();

  const hr = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
    role: "hr",
    name: "HR Manager",
    employeeId: "EMP-FIN-MGR",
  });

  const financeStaff = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: hr.user._id,
    name: "Finance Officer",
    employeeId: "EMP-FIN-1",
  });

  const operationsStaff = await makeStaff({
    companyId: company._id,
    department: operations._id,
    createdBy: head._id,
    name: "Operations Officer",
    employeeId: "EMP-OPS-1",
  });

  const all = await call(getAttendance, { user: hr.user, query: {} });

  assert.equal(all.statusCode, 200);

  const names = all.body.rows.map((row) => row.name);

  assert.ok(names.includes("Finance Officer"));
  assert.ok(names.includes("Operations Officer"));
  assert.ok(
    all.body.rows.some(
      (row) =>
        row.employeeId.toString() === financeStaff.employee._id.toString()
    )
  );
  assert.ok(
    all.body.rows.some(
      (row) =>
        row.employeeId.toString() === operationsStaff.employee._id.toString()
    )
  );

  // The department filter narrows the company-wide register rather than
  // widening a scoped one.
  const filtered = await call(getAttendance, {
    user: hr.user,
    query: { department: operations._id.toString() },
  });

  assert.equal(filtered.statusCode, 200);
  assert.deepEqual(
    filtered.body.rows.map((row) => row.name),
    ["Operations Officer"]
  );
});

test("staff cannot read the company register", async () => {
  const { company, finance, head } = await seedOrganisation();
  const { user } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  const res = await call(getAttendance, { user, query: {} });

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /not allowed/i);
});

test("workers cannot read or regularize the company register", async () => {
  const { company, finance, head } = await seedOrganisation();

  const member = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
    role: "worker",
    name: "Finance Assistant",
    employeeId: "EMP-FIN-2",
  });

  const register = await call(getAttendance, { user: member.user, query: {} });

  assert.equal(register.statusCode, 403);
  assert.match(register.body.error, /not allowed/i);

  const regularize = await call(markAttendance, {
    user: member.user,
    body: {
      employeeId: member.employee._id.toString(),
      date: localDateKey(new Date()),
      checkInTime: "08:05",
      checkOutTime: "17:05",
      status: "Present",
    },
  });

  assert.equal(regularize.statusCode, 403);
  assert.match(regularize.body.error, /regularize/i);
});
