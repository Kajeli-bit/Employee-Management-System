import "dotenv/config";

import mongoose from "mongoose";

import Company from "./models/Company.js";
import {
  seedCompanyDefaults,
  syncCompanyStructure,
} from "./utils/orgDefaults.js";

// Applies the current organisation structure to every company. Safe to run
// repeatedly: departments and teams are matched by key and updated in place,
// and only empty units that no longer exist in the defaults are removed.
// This is how seed changes (renames, new teams, merged departments) reach
// companies that were registered earlier, without deleting anything.
const run = async () => {
  const dbUrl = process.env.ATLASDB_URL;

  if (!dbUrl) {
    console.error("ATLASDB_URL is not set.");
    process.exit(1);
  }

  await mongoose.connect(dbUrl);

  const companies = await Company.find().select("name head").lean();

  for (const company of companies) {
    await seedCompanyDefaults({
      companyId: company._id,
      createdBy: company.head,
    });

    const { summary } = await syncCompanyStructure({
      companyId: company._id,
    });

    const parts = [];

    if (summary.created.length > 0) {
      parts.push(`created ${summary.created.join(", ")}`);
    }

    if (summary.renamed.length > 0) {
      parts.push(`renamed ${summary.renamed.join(", ")}`);
    }

    if (summary.reparented.length > 0) {
      parts.push(`moved ${summary.reparented.join(", ")}`);
    }

    if (summary.removed.length > 0) {
      parts.push(`removed ${summary.removed.join(", ")}`);
    }

    if (summary.kept.length > 0) {
      parts.push(`kept ${summary.kept.join(", ")}`);
    }

    console.log(
      `${company.name}: ${parts.length > 0 ? parts.join("; ") : "already in sync"}.`
    );
  }

  await mongoose.disconnect();
  console.log("Organisation seed complete.");
};

run().catch(async (error) => {
  console.error("SEED ERROR:", error);
  await mongoose.disconnect();
  process.exit(1);
});
