import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import Attendance from "../models/Attendance.js";
import {
  runScheduledSweep,
} from "../controllers/attendanceAutomationController.js";
import {
  connectTestDb,
  clearTestDb,
  createRes,
  disconnectTestDb,
} from "./helpers/harness.js";
import {
  HEAD_OFFICE,
  makeStaff,
  seedOrganisation,
} from "./helpers/fixtures.js";

const CLOCK_IN = new Date("2026-10-23T05:00:00.000Z"); // 08:00 EAT
const ON_SITE_AT_1647 = new Date("2026-10-23T13:47:00.000Z"); // 16:47 EAT
const AUTO_CLOSE_AT_1700 = new Date("2026-10-23T14:00:00.000Z");

const call = async (controller, request) => {
  const res = createRes();
  await controller(request, res);
  return res;
};

const scheduledReq = () => ({
  query: {},
  get: (header) =>
    header.toLowerCase() === "authorization"
      ? `Bearer ${process.env.CRON_SECRET}`
      : "",
});

const createOpenDay = async (employee, date = "2026-10-23") =>
  Attendance.create({
    companyId: employee.companyId,
    employeeId: employee._id,
    userId: employee.userId,
    date,
    checkIn: {
      at: CLOCK_IN,
      latitude: HEAD_OFFICE.latitude,
      longitude: HEAD_OFFICE.longitude,
      accuracyMeters: 10,
      distanceMeters: 12,
      locationName: "Nilric Head Office",
      withinGeofence: true,
    },
    lastSeen: {
      at: ON_SITE_AT_1647,
      latitude: HEAD_OFFICE.latitude,
      longitude: HEAD_OFFICE.longitude,
      accuracyMeters: 8,
      distanceMeters: 12,
      locationName: "Nilric Head Office",
      withinGeofence: true,
    },
    lastSeenInsideAt: ON_SITE_AT_1647,
    status: "Present",
    source: "GPS",
  });

before(async () => {
  await connectTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

after(async () => {
  delete process.env.CRON_SECRET;
  await disconnectTestDb();
});

test("scheduled run evaluates each company's own working-day boundary", async () => {
  process.env.CRON_SECRET = "attendance-secret-for-integration-test";

  const dar = await seedOrganisation({
    name: "Dar company",
    policy: {
      workEnd: "17:00",
      earlyDepartureCheckMinutes: 90,
      autoClockOutConfirmMinutes: 15,
    },
  });
  const darStaff = await makeStaff({
    companyId: dar.company._id,
    department: dar.finance._id,
    createdBy: dar.head._id,
  });
  await createOpenDay(darStaff.employee);

  const later = await seedOrganisation({
    name: "Later shift company",
    policy: {
      workEnd: "18:00",
      earlyDepartureCheckMinutes: 90,
      autoClockOutConfirmMinutes: 15,
    },
  });
  const laterStaff = await makeStaff({
    companyId: later.company._id,
    department: later.finance._id,
    createdBy: later.head._id,
  });
  await createOpenDay(laterStaff.employee);

  const req = scheduledReq();
  req.testNow = new Date("2026-10-23T13:49:00.000Z"); // 16:49 EAT
  const realDate = globalThis.Date;
  // Pin only the scheduled controller's now() call, without changing the
  // asynchronous DB driver's timers or any date calculations before it.
  globalThis.Date = class extends realDate {
    constructor(...args) {
      if (args.length === 0) {
        super(req.testNow);
      } else {
        super(...args);
      }
    }
    static now() {
      return req.testNow.getTime();
    }
  };

  let result;
  try {
    result = await call(runScheduledSweep, req);
  } finally {
    globalThis.Date = realDate;
  }

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.results.length, 2);

  const darRecord = await Attendance.findOne({ employeeId: darStaff.employee._id }).lean();
  const laterRecord = await Attendance.findOne({ employeeId: laterStaff.employee._id }).lean();

  assert.ok(darRecord.autoClockOut.scheduledFor);
  assert.equal(darRecord.autoClockOut.scheduledFor.toISOString(), AUTO_CLOSE_AT_1700.toISOString());

  // The later company's confirmation check is 17:45, not 16:45, so this same
  // UTC instant must not prematurely schedule its clock-out.
  assert.equal(laterRecord.autoClockOut?.scheduledFor || null, null);
});

test("scheduled requests reject missing and incorrect secrets", async () => {
  const original = process.env.CRON_SECRET;

  delete process.env.CRON_SECRET;
  const missing = await call(runScheduledSweep, { query: {} });
  assert.equal(missing.statusCode, 503);

  process.env.CRON_SECRET = "correct";
  const wrong = await call(runScheduledSweep, {
    query: {},
    get: () => "Bearer incorrect",
  });
  assert.equal(wrong.statusCode, 401);

  if (original === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = original;
  }
});
