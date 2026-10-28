
import "dotenv/config";
import express from "express";
import cors from "cors";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import { clerkMiddleware } from "@clerk/express";

import authRouter from "./routes/auth.js";
import departmentRouter from "./routes/department.js";
import employeeRouter from "./routes/employee.js";
import salaryRouter from "./routes/salary.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import attendanceRouter from "./routes/attendance.js";
import { runScheduledSweep } from "./controllers/attendanceAutomationController.js";
import locationRouter from "./routes/locations.js";
import orgRouter from "./routes/org.js";
import superUserRouter from "./routes/superUser.js";

import connectToDatabase from "./db/db.js";
import ensureDatabase from "./db/ensureDatabase.js";

// Lambda-based hosts such as Vercel resolve mongodb+srv records through their
// own resolver, and forcing public resolvers there leaves the Atlas lookup
// hanging until every query times out. Keep the override for local development,
// where some ISPs answer Atlas SRV queries badly.
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  dns.setServers([
    "1.1.1.1",
    "8.8.8.8",
  ]);
}

const app = express();

// Clerk middleware
app.use(clerkMiddleware());

// CLIENT_URL pins the browser origin in deployed environments; without it the
// API stays open so localhost and LAN testing keep working.
const allowedOrigin = process.env.CLIENT_URL;
const configuredOrigins = allowedOrigin
  ? allowedOrigin.split(",").map((origin) => origin.trim())
  : null;
const localDevelopmentOrigins = [
  "http://localhost:5173",
  "http://localhost:5199",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5199",
];

app.use(
  cors({
    origin: configuredOrigins
      ? (origin, callback) => {
          const isAllowed =
            configuredOrigins.includes(origin) ||
            (!process.env.VERCEL &&
              localDevelopmentOrigins.includes(origin));

          callback(null, isAllowed);
        }
      : true,
  })
);
app.use(express.json());

// Static folder
app.use("/uploads", express.static("public/uploads"));

// Health probe for uptime checks; deliberately does not touch the database.
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    uptime: Math.round(process.uptime()),
  });
});

// Says whether this deployment can actually reach Atlas. Only the verdict is
// exposed: no host, credentials or driver message ever leaves the server.
app.get("/api/health/database", async (req, res) => {
  try {
    await connectToDatabase();

    return res.status(200).json({
      success: true,
      database: "connected",
    });
  } catch {
    return res.status(503).json({
      success: false,
      database: process.env.ATLASDB_URL
        ? "unreachable"
        : "not-configured",
    });
  }
});

// Wait for Atlas before any route that may query a Mongoose model. In
// serverless runtimes, do not rely on the fire-and-forget warm-up below.
app.use("/api", ensureDatabase);

// Routes
app.use("/api/super-user", superUserRouter);
app.use("/api/auth", authRouter);
app.use("/api/department", departmentRouter);
app.use("/api/employee", employeeRouter);
app.use("/api/salary", salaryRouter);
app.use("/api/leave", leaveRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/attendance", attendanceRouter);
app.use("/api/locations", locationRouter);
app.use("/api/org", orgRouter);

// Scheduled automatic clock-out check. Vercel cron (or any external scheduler)
// calls this with the CRON_SECRET; it is idempotent, so a frequent schedule is
// harmless.
app.all("/api/cron/attendance", runScheduledSweep);

// Database. Requests wait for this shared connection in the driver's buffer,
// and the health route above reports it when Atlas cannot be reached.
void connectToDatabase().catch(() => {
  // Already logged by the connection helper; the next request retries.
});

// Vercel imports the exported app as a function. Listen only when this file is
// run directly (node index.js / npm start), so local development still works.
const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const PORT = Number(process.env.PORT) || 5000;

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;