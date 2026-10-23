import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../../frontend/src/App.jsx", import.meta.url), "utf8");
const heartbeatSource = await readFile(
  new URL("../../frontend/src/components/attendance/AttendanceHeartbeat.jsx", import.meta.url),
  "utf8"
);
const registerSource = await readFile(
  new URL("../../frontend/src/components/attendance/AttendanceRegister.jsx", import.meta.url),
  "utf8"
);
const myAttendanceSource = await readFile(
  new URL("../../frontend/src/components/attendance/MyAttendance.jsx", import.meta.url),
  "utf8"
);

test("attendance heartbeat is mounted above both employee and manager routes", () => {
  assert.match(appSource, /<BrowserRouter>[\s\S]*?<AttendanceHeartbeat\s*\/>[\s\S]*?<Routes>/);
  assert.match(appSource, /import AttendanceHeartbeat from "\.\/components\/attendance\/AttendanceHeartbeat"/);
});

test("the shared refresh loop nudges the sweep and publishes the latest record", () => {
  assert.match(heartbeatSource, /setInterval\(nudgeSweep, SWEEP_INTERVAL_MS\)/);
  assert.match(heartbeatSource, /POST.*attendance\/sweep|attendance\/sweep/s);
  assert.match(heartbeatSource, /ATTENDANCE_REFRESH_EVENT/);
  assert.match(heartbeatSource, /axios\.get\(`\$\{API_URL\}\/api\/attendance\/today`/);
});

test("personal and register attendance pages consume refresh events", () => {
  assert.match(myAttendanceSource, /window\.addEventListener\("ems:attendance-refresh"/);
  assert.match(myAttendanceSource, /setToday\(event\.detail\)/);
  assert.match(registerSource, /window\.addEventListener\("ems:attendance-refresh"/);
  assert.match(registerSource, /load\(\{ silent: true \}\)/);
});
