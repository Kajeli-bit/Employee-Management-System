import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import Attendance from "../../models/Attendance.js";

let memoryServer = null;

// A real MongoDB instance per test file. The attendance rules depend on unique
// indexes and atomic upserts, so a mocked model would not prove anything.
export const connectTestDb = async () => {
  memoryServer = await MongoMemoryServer.create();

  await mongoose.connect(memoryServer.getUri(), { dbName: "ems_test" });

  // Tests assert on the one-record-per-employee-per-day guarantee, which is an
  // index, not application code.
  await Attendance.syncIndexes();
};

export const clearTestDb = async () => {
  const collections = await mongoose.connection.db.collections();

  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

export const disconnectTestDb = async () => {
  await mongoose.disconnect();

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};

// Minimal Express response double: controllers only use status().json().
export const createRes = () => {
  const res = {
    statusCode: 200,
    body: undefined,
  };

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (payload) => {
    res.body = payload;
    return res;
  };

  return res;
};

export const createReq = ({ user, body = {}, query = {}, params = {} }) => ({
  user,
  body,
  query,
  params,
});
