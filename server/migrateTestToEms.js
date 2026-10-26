import "dotenv/config";
import mongoose from "mongoose";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { databaseNameForRuntime } from "./db/databaseName.js";

const { EJSON } = mongoose.mongo.BSON;
const MongoClient = mongoose.mongo.MongoClient;
const SOURCE_DATABASE = "test";
const TARGET_DATABASE = "ems";
const COLLECTIONS = [
  "companies",
  "departments",
  "users",
  "employees",
  "attendances",
  "leaves",
  "salaries",
  "worklocations",
];
const UNIQUE_KEYS = {
  companies: [["name"]],
  departments: [["companyId", "dep_name"]],
  users: [["username"], ["email"], ["clerkUserId"]],
  employees: [["employeeId"]],
};
const APPLY = process.argv.includes("--apply");
const BACKUP_DIRECTORY = path.resolve(
  process.env.EMS_BACKUP_DIR || "backups"
);

const getPath = (document, pathName) =>
  pathName.split(".").reduce((value, part) => value?.[part], document);

const setPath = (document, pathName, value) => {
  const parts = pathName.split(".");
  const last = parts.pop();
  const parent = parts.reduce((current, part) => current?.[part], document);
  if (parent && last) parent[last] = value;
};

const sameValue = (left, right) =>
  EJSON.stringify(left, { relaxed: false }) ===
  EJSON.stringify(right, { relaxed: false });

const mapExistingIds = (sourceDocuments, targetDocuments, getMatch) => {
  const ids = new Map();

  for (const source of sourceDocuments) {
    const match =
      targetDocuments.find((target) => target._id.equals(source._id)) ||
      getMatch(source);
    ids.set(source._id.toString(), match?._id || source._id);
  }

  return ids;
};

const remapId = (id, mapping) =>
  id != null ? mapping.get(id.toString()) || id : id;

const migrateDocument = (collectionName, source, idMaps, fieldMaps) => {
  const document = EJSON.deserialize(EJSON.serialize(source, { relaxed: false }));
  document._id = remapId(document._id, idMaps[collectionName]);

  for (const [field, mapping] of Object.entries(fieldMaps[collectionName])) {
    const value = getPath(document, field);
    if (value != null) setPath(document, field, remapId(value, mapping));
  }

  return document;
};

const checkUniqueConflicts = (collectionName, documents, targetDocuments) => {
  const conflicts = [];

  for (const key of UNIQUE_KEYS[collectionName] || []) {
    const sourceValues = new Map();

    for (const document of documents) {
      const values = key.map((field) => getPath(document, field));
      if (values.some((value) => value == null || value === "")) continue;
      const fingerprint = EJSON.stringify(values, { relaxed: false });
      const priorId = sourceValues.get(fingerprint);

      if (priorId && priorId !== document._id.toString()) {
        conflicts.push({ collection: collectionName, key: key.join(",") });
      } else {
        sourceValues.set(fingerprint, document._id.toString());
      }

      const targetMatch = targetDocuments.find(
        (target) =>
          !target._id.equals(document._id) &&
          key.every((field, index) =>
            sameValue(getPath(target, field), values[index])
          )
      );

      if (targetMatch) {
        conflicts.push({ collection: collectionName, key: key.join(",") });
      }
    }
  }

  return conflicts;
};

const main = async () => {
  if (databaseNameForRuntime() !== SOURCE_DATABASE) {
    throw new Error(
      "Refusing to run unless this is a local development process pinned to `test`."
    );
  }

  if (!process.env.ATLASDB_URL) {
    throw new Error("ATLASDB_URL is not configured");
  }

  const client = new MongoClient(process.env.ATLASDB_URL, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();
    const sourceDb = client.db(SOURCE_DATABASE);
    const targetDb = client.db(TARGET_DATABASE);
    const sourceData = new Map();
    const targetData = new Map();

    for (const name of COLLECTIONS) {
      const [source, target] = await Promise.all([
        sourceDb.collection(name).find({}).toArray(),
        targetDb.collection(name).find({}).toArray(),
      ]);
      sourceData.set(name, source);
      targetData.set(name, target);
    }

    const targetCompanies = targetData.get("companies");
    const companyIds = mapExistingIds(
      sourceData.get("companies"),
      targetCompanies,
      (source) => targetCompanies.find((target) => target.name === source.name)
    );

    const targetDepartments = targetData.get("departments");
    const departmentIds = mapExistingIds(
      sourceData.get("departments"),
      targetDepartments,
      (source) => {
        const mappedCompanyId = remapId(source.companyId, companyIds);
        return (
          (source.key &&
            targetDepartments.find(
              (target) =>
                target.key === source.key &&
                target.companyId?.equals(mappedCompanyId)
            )) ||
          targetDepartments.find(
            (target) =>
              target.dep_name === source.dep_name &&
              target.kind === source.kind &&
              target.companyId?.equals(mappedCompanyId)
          )
        );
      }
    );

    const targetLocations = targetData.get("worklocations");
    const workLocationIds = mapExistingIds(
      sourceData.get("worklocations"),
      targetLocations,
      (source) => {
        const mappedCompanyId = remapId(source.companyId, companyIds);
        return targetLocations.find(
          (target) =>
            target.name === source.name &&
            target.companyId?.equals(mappedCompanyId)
        );
      }
    );

    const idMaps = {
      companies: companyIds,
      departments: departmentIds,
      worklocations: workLocationIds,
      users: new Map(),
      employees: new Map(),
      attendances: new Map(),
      leaves: new Map(),
      salaries: new Map(),
    };

    for (const name of ["users", "employees", "attendances", "leaves", "salaries"]) {
      for (const document of sourceData.get(name)) {
        idMaps[name].set(document._id.toString(), document._id);
      }
    }

    const fieldMaps = {
      companies: { head: idMaps.users },
      departments: { companyId: companyIds, parent: departmentIds },
      users: { companyId: companyIds, reportsTo: idMaps.users },
      employees: {
        userId: idMaps.users,
        companyId: companyIds,
        createdBy: idMaps.users,
        department: departmentIds,
        workLocation: workLocationIds,
      },
      attendances: {
        companyId: companyIds,
        employeeId: idMaps.employees,
        userId: idMaps.users,
        regularizedBy: idMaps.users,
        "checkIn.location": workLocationIds,
        "checkOut.location": workLocationIds,
        "lastSeen.location": workLocationIds,
      },
      leaves: { employeeId: idMaps.employees, companyId: companyIds },
      salaries: { employeeId: idMaps.employees, companyId: companyIds },
      worklocations: { companyId: companyIds, createdBy: idMaps.users },
    };

    const migrated = new Map(
      COLLECTIONS.map((name) => [
        name,
        sourceData
          .get(name)
          .map((document) =>
            migrateDocument(name, document, idMaps, fieldMaps)
          ),
      ])
    );

    const conflicts = COLLECTIONS.flatMap((name) =>
      checkUniqueConflicts(name, migrated.get(name), targetData.get(name))
    );
    const summary = COLLECTIONS.map((name) => {
      const targetIds = new Set(
        targetData.get(name).map((document) => document._id.toString())
      );
      const documents = migrated.get(name);
      const replaced = documents.filter((document) =>
        targetIds.has(document._id.toString())
      ).length;
      const inserted = documents.length - replaced;

      return {
        collection: name,
        source: sourceData.get(name).length,
        targetBefore: targetData.get(name).length,
        replaced,
        inserted,
        targetExpectedAfter: targetData.get(name).length + inserted,
      };
    });

    console.log(JSON.stringify(summary, null, 2));

    if (conflicts.length) {
      console.error(
        "Migration stopped: source and target have conflicting unique keys under different document IDs.",
        JSON.stringify(conflicts)
      );
      process.exitCode = 2;
      return;
    }

    if (!APPLY) {
      console.log("Dry run only; pass --apply to back up and migrate into `ems`.");
      return;
    }

    const backupPath = path.join(
      BACKUP_DIRECTORY,
      `ems-before-test-import-${new Date().toISOString().replaceAll(":", "-")}.ejson`
    );
    await mkdir(BACKUP_DIRECTORY, { recursive: true });
    const backup = Object.fromEntries(
      COLLECTIONS.map((name) => [name, targetData.get(name)])
    );
    await writeFile(backupPath, EJSON.stringify(backup, { relaxed: false }), {
      flag: "wx",
    });
    console.log(`Existing ems snapshot saved to ${backupPath}`);

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        for (const name of COLLECTIONS) {
          const documents = migrated.get(name);
          if (documents.length === 0) continue;

          await targetDb.collection(name).bulkWrite(
            documents.map((document) => ({
              replaceOne: {
                filter: { _id: document._id },
                replacement: document,
                upsert: true,
              },
            })),
            { ordered: true, session }
          );
        }
      });
    } finally {
      await session.endSession();
    }

    for (const row of summary) {
      const actual = await targetDb.collection(row.collection).countDocuments();
      if (actual !== row.targetExpectedAfter) {
        throw new Error(
          `${row.collection} verification failed: expected ${row.targetExpectedAfter}, found ${actual}`
        );
      }
      console.log(`${row.collection}: verified ${actual} documents`);
    }

    console.log("Migration complete. The source `test` database was not modified.");
  } finally {
    await client.close();
  }
};

main().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
