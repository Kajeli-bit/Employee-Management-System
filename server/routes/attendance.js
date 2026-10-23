import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import {
  recordHeartbeat,
  runCompanySweep,
} from "../controllers/attendanceAutomationController.js";
import {
  checkIn,
  checkOut,
  getAttendance,
  getEmployeeHistory,
  getMyAttendance,
  getToday,
  markAttendance,
  updateAttendance,
} from "../controllers/attendanceController.js";

const router = express.Router();

router.get("/today", authMiddleware, getToday);
router.post("/check-in", authMiddleware, checkIn);
router.post("/check-out", authMiddleware, checkOut);

// The app reports its position here while a day is open, which is what the
// automatic clock-out rules read.
router.post("/heartbeat", authMiddleware, recordHeartbeat);

// HR / Managing Director can run the automatic clock-out check on demand.
router.post("/sweep", authMiddleware, runCompanySweep);
router.get("/me", authMiddleware, getMyAttendance);

router.get("/employee/:id/history", authMiddleware, getEmployeeHistory);
router.get("/", authMiddleware, getAttendance);
router.post("/mark", authMiddleware, markAttendance);
router.patch("/:id", authMiddleware, updateAttendance);

export default router;
