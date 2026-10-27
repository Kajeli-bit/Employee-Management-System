import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import Attendance from "../models/Attendance.js";
import { localDateKey } from "../utils/geo.js";
import {
  closingSummary,
  evaluateDay,
  resolveAutomationPolicy,
} from "../utils/attendanceAutomation.js";

import {
  recordHeartbeat,
  runScheduledSweep,
  sweepCompanyDay,
} from "../controllers/attendanceAutomationController.js";

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

// Friday 23 October 2026, 16:00 in Dar es Salaam (UTC+3).
const TODAY = "2026-10-23";
const AT_1600 = new Date("2026-10-23T13:00:00.000Z");
const AT_1650 = new Date("2026-10-23T13:50:00.000Z");
const AT_1705 = new Date("2026-10-23T14:05:00.000Z");
const AT_1535 = new Date("2026-10-23T12:35:00.000Z");
const AT_1530 = new Date("2026-10-23T12:30:00.000Z");
const AT_1555 = new Date("2026-10-23T12:55:00.000Z");
const CHECK_IN = new Date("2026-10-23T05:00:00.000Z"); // 08:00 local

const POLICY = {
  timezone: "Africa/Dar_es_Salaam",
  workStart: "08:00",
  workEnd: "17:00",
  graceMinutes: 15,
  halfDayMinutes: 240,
  requireGeofence: true,
  autoClockOut: true,
  earlyDepartureCheckMinutes: 90,
  autoClockOutConfirmMinutes: 15,
};

const officeWorker = { workMode: "Office" };
const fieldWorker = { workMode: "Field" };

const seen = ({ at, withinGeofence = true, locationName = "Nilric Head Office" }) => ({
  at,
  latitude: HEAD_OFFICE.latitude,
  longitude: HEAD_OFFICE.longitude,
  accuracyMeters: 10,
  distanceMeters: withinGeofence ? 20 : 12500,
  locationName,
  withinGeofence,
});

const openRecord = ({ lastSeen = null, lastSeenInsideAt = null, autoClockOut = {} } = {}) => ({
  date: TODAY,
  checkIn: { at: CHECK_IN },
  checkOut: null,
  status: "Present",
  lastSeen,
  lastSeenInsideAt,
  autoClockOut,
});

test("a weekday automatic checkout boundary is 17:00", () => {
  const rules = resolveAutomationPolicy(POLICY);

  assert.equal(rules.workEnd, "17:00");
  assert.equal(rules.enabled, true);
});

test("an automatic checkout under nine hours is an absconder unless approved", () => {
  const record = openRecord({ status: "On Time" });
  const at = new Date("2026-10-23T12:00:00.000Z"); // 15:00 EAT, seven hours

  assert.deepEqual(closingSummary({ record, at }), {
    workedMinutes: 420,
    status: "Absconder",
    earlyDeparture: true,
  });
  assert.deepEqual(
    closingSummary({
      record: { ...record, earlyDepartureApproved: true },
      at,
    }),
    { workedMinutes: 420, status: "On Time", earlyDeparture: true }
  );
});

test("a full scheduled close keeps the existing punctuality status", () => {
  const lateRecord = openRecord({ status: "Late" });
  lateRecord.lateByMinutes = 1;
  const onTimeRecord = openRecord({ status: "On Time" });
  const at = new Date("2026-10-23T14:00:00.000Z");

  assert.deepEqual(closingSummary({ record: lateRecord, at }), {
    workedMinutes: 540,
    status: "On Time",
    earlyDeparture: false,
  });
  assert.deepEqual(closingSummary({ record: onTimeRecord, at }), {
    workedMinutes: 540,
    status: "On Time",
    earlyDeparture: false,
  });
});

test("a company shift ending after 17:00 keeps its later checkout boundary", () => {
  const rules = resolveAutomationPolicy({ ...POLICY, workEnd: "18:00" });

  assert.equal(rules.workEnd, "18:00");
});

test("the automatic checkout does not run before 17:00 even after an off-site heartbeat", () => {
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: AT_1600, withinGeofence: false }),
      lastSeenInsideAt: AT_1530,
    }),
    employee: officeWorker,
    policy: POLICY,
    now: AT_1650,
  });

  assert.equal(decision, null);
});

test("a stale off-site heartbeat is not enough to checkout after 17:00", () => {
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: new Date("2026-10-23T13:30:00.000Z"), withinGeofence: false }),
      lastSeenInsideAt: AT_1530,
    }),
    employee: officeWorker,
    policy: POLICY,
    now: AT_1705,
  });

  assert.equal(decision.action, "note");
  assert.equal(decision.outcome, "no-location");
});

test("after 17:00 an off-site device closes at its last on-site time", () => {
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: AT_1705, withinGeofence: false }),
      lastSeenInsideAt: AT_1530,
    }),
    employee: officeWorker,
    policy: POLICY,
    now: AT_1705,
  });

  assert.equal(decision.action, "clock-out");
  assert.equal(decision.outcome, "left-premises");
  assert.equal(decision.at.toISOString(), AT_1530.toISOString());
  assert.match(decision.reason, /registered after 17:00/i);
  assert.match(decision.reason, /last being seen on site at 15:30/i);
});

test("when no later on-site heartbeat exists, checkout falls back to clock-in time", () => {
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: AT_1705, withinGeofence: false }),
    }),
    employee: officeWorker,
    policy: POLICY,
    now: AT_1705,
  });

  assert.equal(decision.action, "clock-out");
  assert.equal(decision.at.toISOString(), CHECK_IN.toISOString());
});

test("still on site at 16:00 keeps the day open", () => {
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: new Date("2026-10-23T12:55:00.000Z") }),
      lastSeenInsideAt: new Date("2026-10-23T12:55:00.000Z"),
    }),
    employee: officeWorker,
    policy: POLICY,
    now: AT_1600,
  });

  assert.equal(decision, null);
});

test("Saturday policy resolves to 09:00–13:00", () => {
  const rules = resolveAutomationPolicy(POLICY);

  assert.equal(rules.saturdayWorkStart, "09:00");
  assert.equal(rules.saturdayWorkEnd, "13:00");
});

test("Saturday automatic checkout still waits until after 17:00", () => {
  const lastInsideAt = new Date("2026-10-24T09:50:00.000Z"); // 12:50 EAT
  const afterFive = new Date("2026-10-24T14:05:00.000Z"); // 17:05 EAT
  const decision = evaluateDay({
    record: {
      ...openRecord({
        lastSeen: seen({ at: afterFive, withinGeofence: false }),
        lastSeenInsideAt: lastInsideAt,
      }),
      date: "2026-10-24",
    },
    employee: officeWorker,
    policy: POLICY,
    now: afterFive,
  });

  assert.equal(decision.action, "clock-out");
  assert.equal(decision.at.toISOString(), lastInsideAt.toISOString());
  assert.match(decision.reason, /after 17:00/);
});

test("completed nine hours is not an absconder, but one minute under is", () => {
  const record = openRecord();
  const atNineHours = new Date("2026-10-23T14:00:00.000Z");
  const oneMinuteShort = new Date(atNineHours.getTime() - 60 * 1000);

  assert.deepEqual(closingSummary({ record, at: atNineHours }), {
    workedMinutes: 540,
    status: "On Time",
    earlyDeparture: false,
  });
  assert.deepEqual(closingSummary({ record, at: oneMinuteShort }), {
    workedMinutes: 539,
    status: "Absconder",
    earlyDeparture: true,
  });
});

test("a fresh on-site location after 17:00 never triggers automatic checkout", () => {
  const lastSeen = new Date("2026-10-23T14:05:00.000Z");
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: lastSeen, withinGeofence: true }),
      lastSeenInsideAt: lastSeen,
    }),
    employee: officeWorker,
    policy: POLICY,
    now: lastSeen,
  });

  assert.equal(decision, null);
});

test("Sunday is not a working day for automatic clock-out", () => {
  const sundayRecord = {
    ...openRecord({
      lastSeen: seen({ at: new Date("2026-10-25T10:00:00.000Z"), withinGeofence: false }),
    }),
    date: "2026-10-25",
  };

  assert.equal(
    evaluateDay({
      record: sundayRecord,
      employee: officeWorker,
      policy: POLICY,
      now: new Date("2026-10-25T11:00:00.000Z"),
    }),
    null
  );
});

test("an on-site device remains open after 17:00", () => {
  const afterFive = new Date("2026-10-23T14:05:00.000Z");
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: afterFive }),
      lastSeenInsideAt: afterFive,
    }),
    employee: officeWorker,
    policy: POLICY,
    now: afterFive,
  });

  assert.equal(decision, null);
});

test("a no-location decision does not guess an automatic checkout after 17:00", () => {
  const decision = evaluateDay({
    record: openRecord({ lastSeen: seen({ at: AT_1705, withinGeofence: true }) }),
    employee: officeWorker,
    policy: POLICY,
    now: AT_1705,
  });

  assert.equal(decision, null);
});





test("field staff are never closed early for being away from the office", () => {
  const record = openRecord({
    lastSeen: seen({ at: AT_1535, withinGeofence: false }),
  });

  assert.equal(
    evaluateDay({ record, employee: fieldWorker, policy: POLICY, now: AT_1600 }),
    null
  );

  const confirmed = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: AT_1650, withinGeofence: false }),
    }),
    employee: fieldWorker,
    policy: POLICY,
    now: AT_1650,
  });

  assert.equal(confirmed, null);
});

test("an already closed day is never touched", () => {
  const decision = evaluateDay({
    record: { ...openRecord({ lastSeen: seen({ at: AT_1650 }) }), checkOut: { at: AT_1650 } },
    employee: officeWorker,
    policy: POLICY,
    now: AT_1705,
  });

  assert.equal(decision, null);
});

test("the policy switch turns the automation off", () => {
  const decision = evaluateDay({
    record: openRecord({ lastSeen: seen({ at: AT_1650 }) }),
    employee: officeWorker,
    policy: { ...POLICY, autoClockOut: false },
    now: AT_1705,
  });

  assert.equal(decision, null);
});

// --- Heartbeat and sweep against a real database -----------------------------

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

const startDay = (employee, { lastSeen, lastSeenInsideAt } = {}) =>
  Attendance.create({
    companyId: employee.companyId,
    employeeId: employee._id,
    userId: employee.userId,
    date: TODAY,
    checkIn: {
      at: CHECK_IN,
      latitude: HEAD_OFFICE.latitude,
      longitude: HEAD_OFFICE.longitude,
      accuracyMeters: 10,
      distanceMeters: 12,
      locationName: "Nilric Head Office",
      withinGeofence: true,
    },
    status: "Present",
    source: "GPS",
    lastSeen: lastSeen || null,
    lastSeenInsideAt: lastSeenInsideAt || null,
    lastSeenInside: lastSeenInsideAt
      ? seen({ at: lastSeenInsideAt })
      : null,
  });

const storedRecord = (employee) =>
  Attendance.findOne({ employeeId: employee._id }).lean();

test("a heartbeat stores the position against the open day", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { user, employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  await startDay(employee);
  const realDate = globalThis.Date;
  globalThis.Date = class extends realDate {
    constructor(...args) {
      if (args.length === 0) {
        super("2026-10-23T10:00:00.000Z");
      } else {
        super(...args);
      }
    }
    static now() {
      return new realDate("2026-10-23T10:00:00.000Z").getTime();
    }
  };

  let res;
  try {
    res = await call(recordHeartbeat, {
      user,
      body: { ...FAR_AWAY, accuracy: 12 },
    });
  } finally {
    globalThis.Date = realDate;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.tracked, true);
  assert.equal(res.body.withinGeofence, false);
  assert.ok(res.body.distanceMeters > 9000);

  const stored = await storedRecord(employee);

  assert.equal(stored.lastSeen.withinGeofence, false);
  assert.equal(stored.lastSeenInside, null);
  assert.ok(stored.lastSeen.at);
  // Nothing inside today, so there is no inside reading to fall back on.
  assert.equal(stored.lastSeenInsideAt, null);
});

test("a heartbeat inside the fence remembers the on-site time", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { user, employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  await startDay(employee);
  const realDate = globalThis.Date;
  globalThis.Date = class extends realDate {
    constructor(...args) {
      if (args.length === 0) {
        super("2026-10-23T10:00:00.000Z");
      } else {
        super(...args);
      }
    }
    static now() {
      return new realDate("2026-10-23T10:00:00.000Z").getTime();
    }
  };

  let res;
  try {
    res = await call(recordHeartbeat, {
      user,
      body: { ...HEAD_OFFICE, accuracy: 8 },
    });
  } finally {
    globalThis.Date = realDate;
  }

  assert.equal(res.body.withinGeofence, true);

  const stored = await storedRecord(employee);

  assert.ok(stored.lastSeenInsideAt, "an on-site reading must be remembered");
  assert.equal(stored.lastSeenInside.locationName, "Nilric Head Office");
  assert.equal(stored.checkOut, null);
});

test("a heartbeat outside a working day stores nothing", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { user } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  const res = await call(recordHeartbeat, {
    user,
    body: { ...HEAD_OFFICE, accuracy: 8 },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.tracked, false);
  assert.equal(res.body.reason, "no-open-day");
  assert.equal(await Attendance.countDocuments({}), 0);
});

test("the after-17:00 sweep records the last on-site time and absconder status", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  await startDay(employee, {
    lastSeen: seen({ at: AT_1705, withinGeofence: false }),
    lastSeenInsideAt: AT_1530,
  });

  const summary = await sweepCompanyDay({
    companyId: company._id,
    now: AT_1705,
  });

  assert.equal(summary.checked, 1);
  assert.equal(summary.closed, 1);
  assert.equal(summary.scheduled, 0);

  const stored = await storedRecord(employee);
  assert.equal(stored.checkOut.automatic, true);
  assert.equal(stored.checkOut.at.toISOString(), AT_1530.toISOString());
  assert.equal(stored.checkOut.withinGeofence, true);
  assert.equal(stored.checkOut.locationName, "Nilric Head Office");
  assert.match(stored.checkOut.reason, /registered after 17:00/i);
  assert.equal(stored.workedMinutes, 450);
  assert.equal(stored.status, "Absconder");
  assert.equal(stored.earlyDeparture, true);
});

test("the sweep never auto-closes an employee whose latest fix is on site", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  await startDay(employee, {
    lastSeen: seen({ at: AT_1650 }),
    lastSeenInsideAt: AT_1650,
  });

  const first = await sweepCompanyDay({ companyId: company._id, now: AT_1650 });

  assert.equal(first.closed, 0);
  assert.equal(first.scheduled, 0);

  const open = await storedRecord(employee);
  assert.equal(open.checkOut, null);
  assert.equal(open.autoClockOut.scheduledFor, null);

  const second = await sweepCompanyDay({ companyId: company._id, now: AT_1705 });

  assert.equal(second.closed, 0);
  const stillOpen = await storedRecord(employee);
  assert.equal(stillOpen.checkOut, null);
});

test("running the sweep twice never closes a day twice", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  await startDay(employee, {
    lastSeen: seen({ at: AT_1705, withinGeofence: false }),
    lastSeenInsideAt: AT_1530,
  });

  await sweepCompanyDay({ companyId: company._id, now: AT_1705 });
  await sweepCompanyDay({ companyId: company._id, now: AT_1705 });

  const stored = await storedRecord(employee);

  assert.equal(stored.checkOut.at.toISOString(), AT_1530.toISOString());

  const count = await Attendance.countDocuments({ employeeId: employee._id });

  assert.equal(count, 1);
});

test("a manual clock-out wins over the sweep", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  await startDay(employee, {
    lastSeen: seen({ at: AT_1650 }),
    lastSeenInsideAt: AT_1650,
  });

  await Attendance.updateOne(
    { employeeId: employee._id },
    {
      $set: {
        checkOut: {
          at: AT_1650,
          locationName: "Nilric Head Office",
          withinGeofence: true,
        },
        workedMinutes: 530,
        status: "Present",
      },
    }
  );

  const summary = await sweepCompanyDay({ companyId: company._id, now: AT_1705 });

  assert.equal(summary.checked, 0);

  const stored = await storedRecord(employee);

  assert.equal(stored.checkOut.automatic, false);
  assert.equal(stored.workedMinutes, 530);
});

test("the scheduled entry point refuses to run without its secret", async () => {
  const previous = process.env.CRON_SECRET;

  delete process.env.CRON_SECRET;

  const disabled = await call(runScheduledSweep, { query: {} });

  assert.equal(disabled.statusCode, 503);

  process.env.CRON_SECRET = "test-secret";

  const build = (authorization) => ({
    query: {},
    get: (name) => (name.toLowerCase() === "authorization" ? authorization : ""),
  });

  const rejected = await call(runScheduledSweep, build("Bearer wrong"));

  assert.equal(rejected.statusCode, 401);

  const accepted = await call(runScheduledSweep, build("Bearer test-secret"));

  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.success, true);
  assert.ok(Array.isArray(accepted.body.results));

  if (previous === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = previous;
  }
});

test("a whole day with recent on-site presence stays open for manual checkout", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  // On site all afternoon, last report two minutes before the presence check.
  const lastOnSite = new Date("2026-10-23T13:47:00.000Z"); // 16:47 local

  await startDay(employee, {
    lastSeen: seen({ at: lastOnSite }),
    lastSeenInsideAt: lastOnSite,
  });

  // 15:35 — the early check sees an old on-site reading and does nothing.
  await sweepCompanyDay({
    companyId: company._id,
    now: new Date("2026-10-23T12:35:00.000Z"),
  });

  assert.equal((await storedRecord(employee)).checkOut, null);

  // 16:47 — a recent on-site position means the employee is still at work.
  await sweepCompanyDay({ companyId: company._id, now: lastOnSite });

  const stillAtWork = await storedRecord(employee);
  assert.equal(stillAtWork.checkOut, null);
  assert.equal(stillAtWork.autoClockOut.scheduledFor, null);

  // Even after shift end, the system does not infer a departure from time alone.
  await sweepCompanyDay({
    companyId: company._id,
    now: new Date("2026-10-23T14:00:30.000Z"),
  });

  const stored = await storedRecord(employee);
  assert.equal(stored.checkOut, null);
});

test("a heartbeat after the automatic close is ignored", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { user, employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  await startDay(employee, {
    lastSeen: seen({ at: AT_1555, withinGeofence: false }),
    lastSeenInsideAt: AT_1530,
  });

  await sweepCompanyDay({ companyId: company._id, now: AT_1600 });
  await Attendance.updateOne(
    { employeeId: employee._id },
    { $set: { lastSeen: seen({ at: AT_1650, withinGeofence: false }) } }
  );
  await sweepCompanyDay({ companyId: company._id, now: AT_1705 });

  const closed = await storedRecord(employee);

  const realDate = globalThis.Date;
  globalThis.Date = class extends realDate {
    constructor(...args) {
      if (args.length === 0) {
        super("2026-10-23T14:05:00.000Z");
      } else {
        super(...args);
      }
    }
    static now() {
      return new realDate("2026-10-23T14:05:00.000Z").getTime();
    }
  };

  let res;
  try {
    res = await call(recordHeartbeat, {
      user,
      body: { ...HEAD_OFFICE, accuracy: 10 },
    });
  } finally {
    globalThis.Date = realDate;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.tracked, false);
  assert.equal(res.body.reason, "no-open-day");

  const after = await storedRecord(employee);

  assert.equal(after.checkOut.at.toISOString(), closed.checkOut.at.toISOString());
  assert.equal(after.lastSeen.at.toISOString(), AT_1650.toISOString());
});

test("the sweep only touches today's open days", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  const yesterday = localDateKey(new Date(AT_1600.getTime() - 86400000), POLICY.timezone);

  await Attendance.create({
    companyId: company._id,
    employeeId: employee._id,
    userId: employee.userId,
    date: yesterday,
    checkIn: { at: new Date("2026-10-22T05:00:00.000Z") },
    status: "Present",
    source: "GPS",
  });

  const summary = await sweepCompanyDay({ companyId: company._id, now: AT_1600 });

  assert.equal(summary.checked, 0);

  const stored = await Attendance.findOne({ date: yesterday }).lean();

  assert.equal(stored.checkOut, null);
});
