import "dotenv/config";
import mongoose from "mongoose";

import User from "./models/User.js";
import { getRole, roleLabel } from "./utils/roles.js";

// Rewrites accounts that still store a retired role key (department_manager,
// team_lead, employee, …) to the three-role model. Existing keys keep working
// through the legacy alias map, so this is housekeeping rather than a required
// step. Dry run by default; pass --apply to write.
const apply = process.argv.includes("--apply");

const run = async () => {
  await mongoose.connect(process.env.ATLASDB_URL);

  try {
    const users = await User.find({}).select("name email role").lean();
    const changes = [];

    for (const user of users) {
      const resolved = getRole(user.role)?.key;

      if (resolved && resolved !== user.role) {
        changes.push({
          id: user._id,
          name: user.name,
          email: user.email,
          from: user.role,
          to: resolved,
        });
      }
    }

    if (changes.length === 0) {
      console.log("All accounts already use the three-role model. Nothing to do.");
      return;
    }

    for (const change of changes) {
      console.log(
        `${change.name} <${change.email}>: ${change.from} -> ${change.to} (${roleLabel(change.to)})`
      );
    }

    if (!apply) {
      console.log(
        `\n${changes.length} account(s) need updating. Re-run with --apply to write.`
      );
      return;
    }

    await User.bulkWrite(
      changes.map((change) => ({
        updateOne: {
          filter: { _id: change.id },
          update: { $set: { role: change.to, updatedAt: new Date() } },
        },
      }))
    );

    console.log(`\nUpdated ${changes.length} account(s).`);
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("ROLE MIGRATION FAILED:", error);
  process.exitCode = 1;
});
