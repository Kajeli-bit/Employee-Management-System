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

test("a company finishing at 17:00 checks at 15:30, 16:45 and 17:00", () => {
  const rules = resolveAutomationPolicy(POLICY);

  assert.equal(rules.earlyDepartureAt, "15:30");
  assert.equal(rules.confirmAt, "16:45");
  assert.equal(rules.closeAt, "17:00");
  assert.equal(rules.enabled, true);
});

test("an early automatic departure is an absconder unless explicitly approved", () => {
  const record = openRecord({ status: "On Time" });
  const at = new Date("2026-10-23T14:00:00.000Z");

  assert.deepEqual(closingSummary({ record, at, earlyDeparture: true }), {
    workedMinutes: 540,
    status: "Absconder",
    earlyDeparture: true,
  });
  assert.deepEqual(
    closingSummary({
      record: { ...record, earlyDepartureApproved: true },
      at,
      earlyDeparture: true,
    }),
    { workedMinutes: 540, status: "On Time", earlyDeparture: true }
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

test("a later finish shifts the checks with it", () => {
  const rules = resolveAutomationPolicy({ ...POLICY, workEnd: "18:00" });

  assert.equal(rules.earlyDepartureAt, "16:30");
  assert.equal(rules.confirmAt, "17:45");
  assert.equal(rules.closeAt, "18:00");
});

test("nothing happens before the first check", () => {
  const decision = evaluateDay({
    record: openRecord({ lastSeen: seen({ at: AT_1535, withinGeofence: false }) }),
    employee: officeWorker,
    policy: POLICY,
    now: new Date("2026-10-23T12:00:00.000Z"), // 15:00 local
  });

  assert.equal(decision, null);
});

test("an earlier off-site heartbeat is handled at the early-departure check", () => {
  const lastInsideAt = new Date("2026-10-23T10:00:00.000Z");
  const outsideAt = new Date("2026-10-23T10:05:00.000Z");
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: outsideAt, withinGeofence: false }),
      lastSeenInsideAt: lastInsideAt,
    }),
    employee: officeWorker,
    policy: POLICY,
    now: AT_1530,
  });

  assert.equal(decision.action, "schedule");
  assert.equal(decision.scheduledFor.toISOString(), "2026-10-23T14:00:00.000Z");
  assert.match(decision.reason, /last seen on site at 13:00/i);
});

test("leaving the premises after 15:30 queues a close at 17:00 and records the last on-site time", () => {
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: AT_1535, withinGeofence: false }),
      lastSeenInsideAt: AT_1530,
    }),
    employee: officeWorker,
    policy: POLICY,
    now: AT_1600,
  });

  assert.equal(decision.action, "schedule");
  assert.equal(decision.outcome, "left-premises");
  assert.equal(decision.scheduledFor.toISOString(), "2026-10-23T14:00:00.000Z");
  assert.match(decision.reason, /last seen on site at 15:30/i);
});

test("a long tracking gap falls back to the first off-site reading", () => {
  const decision = evaluateDay({
    record: openRecord({
      // The device only reported at 09:00 and then once more from 12 km away.
      lastSeen: seen({ at: AT_1600, withinGeofence: false }),
      lastSeenInsideAt: new Date("2026-10-23T06:00:00.000Z"),
      lastSeenInside: seen({
        at: new Date("2026-10-23T06:00:00.000Z"),
        withinGeofence: true,
      }),
    }),
    employee: officeWorker,
    policy: POLICY,
    now: new Date("2026-10-23T13:10:00.000Z"),
  });

  assert.equal(decision.action, "schedule");
  assert.equal(decision.scheduledFor.toISOString(), "2026-10-23T14:00:00.000Z");
  assert.match(decision.reason, /last seen on site at 09:00/i);
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

test("Saturday automation uses the 09:00–13:00 workday", () => {
  const saturdayRecord = {
    ...openRecord({
      lastSeen: seen({ at: new Date("2026-10-24T09:00:00.000Z"), withinGeofence: false }),
      lastSeenInsideAt: new Date("2026-10-24T08:55:00.000Z"),
    }),
    date: "2026-10-24",
  };
  const decision = evaluateDay({
    record: saturdayRecord,
    employee: officeWorker,
    policy: POLICY,
    now: new Date("2026-10-24T09:10:00.000Z"), // 12:10 EAT
  });

  assert.equal(decision.action, "schedule");
  assert.equal(decision.scheduledFor.toISOString(), "2026-10-24T10:00:00.000Z");
  assert.match(decision.reason, /last seen on site at 11:55/i);
  assert.match(decision.reason, /13:00/);
});

test("the automatic policy uses the last inside fix as the departure audit position", () => {
  const outside = seen({ at: AT_1535, withinGeofence: false });
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: outside,
      lastSeenInsideAt: AT_1530,
      lastSeenInside: seen({ at: AT_1530 }),
    }),
    employee: officeWorker,
    policy: POLICY,
    now: AT_1600,
  });

  assert.equal(decision.outcome, "left-premises");
  assert.match(decision.reason, /last seen on site at 15:30/i);
});

test("a fresh on-site location cancels a queued early departure", () => {
  const returnedAt = new Date("2026-10-23T13:05:00.000Z");
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: returnedAt, withinGeofence: true }),
      autoClockOut: {
        scheduledFor: new Date("2026-10-23T14:00:00.000Z"),
        outcome: "left-premises",
        evaluatedAt: new Date("2026-10-23T13:00:00.000Z"),
      },
    }),
    employee: officeWorker,
    policy: POLICY,
    now: returnedAt,
  });

  assert.equal(decision.action, "cancel-schedule");
  assert.equal(decision.outcome, "returned-on-site");
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

test("on site at the 16:45 check schedules the 17:00 close", () => {
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: new Date("2026-10-23T13:48:00.000Z") }),
      lastSeenInsideAt: new Date("2026-10-23T13:48:00.000Z"),
    }),
    employee: officeWorker,
    policy: POLICY,
    now: AT_1650,
  });

  assert.equal(decision.action, "schedule");
  assert.equal(decision.scheduledFor.toISOString(), "2026-10-23T14:00:00.000Z");
});

test("a scheduled day closes at 17:00 even when the sweep runs late", () => {
  const decision = evaluateDay({
    record: openRecord({
      lastSeen: seen({ at: new Date("2026-10-23T13:48:00.000Z") }),
      autoClockOut: { scheduledFor: new Date("2026-10-23T14:00:00.000Z") },
    }),
    employee: officeWorker,
    policy: POLICY,
    now: new Date("2026-10-23T15:30:00.000Z"), // 18:30 local, sweep was late
  });

  assert.equal(decision.action, "clock-out");
  assert.equal(decision.at.toISOString(), "2026-10-23T14:00:00.000Z");
});

test("no location at the presence check leaves the day for review", () => {
  const decision = evaluateDay({
    record: openRecord(),
    employee: officeWorker,
    policy: POLICY,
    now: AT_1650,
  });

  assert.equal(decision.action, "note");
  assert.equal(decision.outcome, "no-location");
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

  assert.equal(confirmed.action, "schedule");
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

test("the sweep queues an early departure and leaves the record open until 17:00", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  await startDay(employee, {
    lastSeen: seen({ at: AT_1535, withinGeofence: false }),
    lastSeenInsideAt: AT_1530,
  });

  const summary = await sweepCompanyDay({
    companyId: company._id,
    now: AT_1600,
  });

  assert.equal(summary.checked, 1);
  assert.equal(summary.closed, 0);
  assert.equal(summary.scheduled, 1);

  const queued = await storedRecord(employee);

  assert.equal(queued.checkOut, null);
  assert.equal(queued.autoClockOut.scheduledFor.toISOString(), "2026-10-23T14:00:00.000Z");
  assert.match(queued.autoClockOut.reason, /last seen on site at 15:30/i);

  const closedSummary = await sweepCompanyDay({ companyId: company._id, now: AT_1705 });
  assert.equal(closedSummary.closed, 1);

  const stored = await storedRecord(employee);
  assert.equal(stored.checkOut.automatic, true);
  assert.equal(stored.checkOut.at.toISOString(), "2026-10-23T14:00:00.000Z");
  assert.equal(stored.checkOut.withinGeofence, true);
  assert.equal(stored.checkOut.locationName, "Nilric Head Office");
  assert.match(stored.checkOut.reason, /last seen on site at 15:30/i);
  assert.equal(stored.workedMinutes, 540);
  assert.equal(stored.status, "Absconder");
  assert.equal(stored.earlyDeparture, true);
});

test("the sweep leaves an on-site employee open and closes them at 17:00", async () => {
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
  assert.equal(first.scheduled, 1);

  const open = await storedRecord(employee);

  assert.equal(open.checkOut, null);
  assert.equal(open.autoClockOut.scheduledFor.toISOString(), "2026-10-23T14:00:00.000Z");

  const second = await sweepCompanyDay({ companyId: company._id, now: AT_1705 });

  assert.equal(second.closed, 1);

  const stored = await storedRecord(employee);

  assert.equal(stored.checkOut.automatic, true);
  assert.equal(stored.checkOut.at.toISOString(), "2026-10-23T14:00:00.000Z");
  assert.equal(stored.workedMinutes, 540);
});

test("running the sweep twice never closes a day twice", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  await startDay(employee, {
    lastSeen: seen({ at: AT_1535, withinGeofence: false }),
    lastSeenInsideAt: AT_1530,
  });

  await sweepCompanyDay({ companyId: company._id, now: AT_1600 });
  await sweepCompanyDay({ companyId: company._id, now: AT_1600 });
  await sweepCompanyDay({ companyId: company._id, now: AT_1705 });

  const stored = await storedRecord(employee);

  assert.equal(stored.checkOut.at.toISOString(), "2026-10-23T14:00:00.000Z");

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

test("a whole forgotten day closes at 17:00, not when the sweep happens to run", async () => {
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

  // 16:47 — the presence check queues the close.
  await sweepCompanyDay({ companyId: company._id, now: lastOnSite });

  const queued = await storedRecord(employee);

  assert.equal(queued.checkOut, null);
  assert.equal(queued.autoClockOut.scheduledFor.toISOString(), "2026-10-23T14:00:00.000Z");

  // 16:59 — still open, the employee could still clock out themselves.
  await sweepCompanyDay({
    companyId: company._id,
    now: new Date("2026-10-23T13:59:00.000Z"),
  });

  assert.equal((await storedRecord(employee)).checkOut, null);

  // 17:00:30 — a sweep a fraction late still records 17:00.
  await sweepCompanyDay({
    companyId: company._id,
    now: new Date("2026-10-23T14:00:30.000Z"),
  });

  const stored = await storedRecord(employee);

  assert.equal(stored.checkOut.automatic, true);
  assert.equal(stored.checkOut.at.toISOString(), "2026-10-23T14:00:00.000Z");
  assert.equal(stored.workedMinutes, 540);
  assert.match(stored.checkOut.reason, /on site/i);
});

test("a heartbeat after the automatic close is ignored", async () => {
  const { company, finance, head } = await seedOrganisation({ policy: POLICY });
  const { user, employee } = await makeStaff({
    companyId: company._id,
    department: finance._id,
    createdBy: head._id,
  });

  await startDay(employee, {
    lastSeen: seen({ at: AT_1535, withinGeofence: false }),
    lastSeenInsideAt: AT_1530,
  });

  await sweepCompanyDay({ companyId: company._id, now: AT_1600 });
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
  assert.equal(after.lastSeen.at.toISOString(), AT_1535.toISOString());
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
