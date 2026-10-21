import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateGeofence,
  haversineDistanceMeters,
  isWithinFence,
  localDateKey,
  localMinutesOfDay,
  localTimeParts,
  timeStringToMinutes,
  zonedTimeToUtc,
} from "../utils/geo.js";

const HEAD_OFFICE = {
  name: "Nilric Head Office",
  latitude: -6.8167,
  longitude: 39.2889,
  radiusMeters: 250,
  isActive: true,
};

test("haversine distance is realistic", () => {
  const samePoint = haversineDistanceMeters(
    { latitude: -6.8167, longitude: 39.2889 },
    { latitude: -6.8167, longitude: 39.2889 }
  );

  assert.equal(samePoint, 0);

  // Roughly 111 m per 0.001 degrees of latitude at the equator.
  const nearby = haversineDistanceMeters(
    { latitude: -6.8167, longitude: 39.2889 },
    { latitude: -6.8177, longitude: 39.2889 }
  );

  assert.ok(nearby >= 105 && nearby <= 115, `unexpected distance ${nearby}`);
});

test("a fix inside the radius passes and a distant one fails", () => {
  const inside = evaluateGeofence(
    { latitude: -6.8168, longitude: 39.2889, accuracy: 8 },
    [HEAD_OFFICE]
  );

  assert.equal(inside.withinFence, true);
  assert.equal(inside.location.name, "Nilric Head Office");

  const outside = evaluateGeofence(
    { latitude: -6.9, longitude: 39.2889, accuracy: 10 },
    [HEAD_OFFICE]
  );

  assert.equal(outside.withinFence, false);
  assert.ok(outside.distanceMeters > 9000);
});

test("GPS accuracy tolerance only absorbs small errors", () => {
  assert.equal(isWithinFence(255, 250, 20), true);
  assert.equal(isWithinFence(400, 250, 20), false);
  // The tolerance is capped at 40 m even for a terrible reading.
  assert.equal(isWithinFence(500, 250, 300), false);
});

test("no active location means no geofenced match", () => {
  const result = evaluateGeofence(
    { latitude: -6.8167, longitude: 39.2889, accuracy: 5 },
    [{ ...HEAD_OFFICE, isActive: false }]
  );

  assert.equal(result.withinFence, false);
  assert.equal(result.location, null);
});

test("dates use the Dar es Salaam calendar, not UTC", () => {
  // 22:30 UTC on 19 October is 01:30 on 20 October in Dar es Salaam (UTC+3).
  const lateUtc = new Date("2026-10-19T22:30:00.000Z");

  assert.equal(localDateKey(lateUtc, "Africa/Dar_es_Salaam"), "2026-10-20");
  assert.equal(
    localMinutesOfDay(lateUtc, "Africa/Dar_es_Salaam"),
    90
  );
});

test("zoned wall-clock times convert to the right instant", () => {
  const instant = zonedTimeToUtc(
    "2026-10-20",
    "08:15",
    "Africa/Dar_es_Salaam"
  );

  assert.equal(instant.toISOString(), "2026-10-20T05:15:00.000Z");
  assert.equal(
    localTimeParts(instant, "Africa/Dar_es_Salaam").hour,
    8
  );
  assert.equal(zonedTimeToUtc("2026-10-20", "25:00"), null);
  assert.equal(zonedTimeToUtc("20-10-2026", "08:00"), null);
});

test("work start parsing tolerates bad input", () => {
  assert.equal(timeStringToMinutes("08:15"), 495);
  assert.equal(timeStringToMinutes("8:15"), 495);
  assert.equal(timeStringToMinutes("bad", 480), 480);
});
