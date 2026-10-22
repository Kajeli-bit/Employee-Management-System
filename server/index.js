
import "dotenv/config";
import express from "express";
import cors from "cors";
import dns from "dns";
import { clerkMiddleware } from "@clerk/express";

import authRouter from "./routes/auth.js";
import departmentRouter from "./routes/department.js";
import employeeRouter from "./routes/employee.js";
import salaryRouter from "./routes/salary.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import attendanceRouter from "./routes/attendance.js";
import locationRouter from "./routes/locations.js";
import orgRouter from "./routes/org.js";

import connectToDatabase from "./db/db.js";

dns.setServers([
  "1.1.1.1",
  "8.8.8.8",
]);

const app = express();

// Clerk middleware
app.use(clerkMiddleware());

// CLIENT_URL pins the browser origin in deployed environments; without it the
// API stays open so localhost and LAN testing keep working.
const allowedOrigin = process.env.CLIENT_URL;

app.use(
  cors({
    origin: allowedOrigin
      ? allowedOrigin.split(",").map((origin) => origin.trim())
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

// Routes
app.use("/api/auth", authRouter);
app.use("/api/department", departmentRouter);
app.use("/api/employee", employeeRouter);
app.use("/api/salary", salaryRouter);
app.use("/api/leave", leaveRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/attendance", attendanceRouter);
app.use("/api/locations", locationRouter);
app.use("/api/org", orgRouter);

// Database
connectToDatabase();

// Server
const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});