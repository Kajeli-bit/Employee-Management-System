import test from "node:test";
import assert from "node:assert/strict";

import { createEnsureDatabase } from "../db/ensureDatabase.js";

test("database middleware waits for connection before continuing", async () => {
  let connected = false;
  let continued = false;
  const ensureDatabase = createEnsureDatabase(async () => {
    await Promise.resolve();
    connected = true;
  });

  await ensureDatabase(
    {},
    {},
    () => {
      assert.equal(connected, true);
      continued = true;
    }
  );

  assert.equal(continued, true);
});

test("database middleware returns a safe 503 when Atlas is unavailable", async () => {
  let responseStatus;
  let responseBody;
  let continued = false;
  const ensureDatabase = createEnsureDatabase(async () => {
    throw new Error("private Atlas connection details");
  });
  const response = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await ensureDatabase({}, response, () => {
    continued = true;
  });

  assert.equal(responseStatus, 503);
  assert.deepEqual(responseBody, {
    success: false,
    error: "Database temporarily unavailable. Please try again.",
    code: "DATABASE_UNAVAILABLE",
  });
  assert.equal(continued, false);
});
