import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import {
  checkIn,
  checkOut,
  getAttendance,
  getMyAttendance,
  getToday,
  markAttendance,
  updateAttendance,
} from "../controllers/attendanceController.js";

const router = express.Router();

router.get("/today", authMiddleware, getToday);
router.post("/check-in", authMiddleware, checkIn);
router.post("/check-out", authMiddleware, checkOut);
router.get("/me", authMiddleware, getMyAttendance);

router.get("/", authMiddleware, getAttendance);
router.post("/mark", authMiddleware, markAttendance);
router.patch("/:id", authMiddleware, updateAttendance);

export default router;
