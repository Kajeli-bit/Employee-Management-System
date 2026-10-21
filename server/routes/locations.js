import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import {
  addLocation,
  deactivateLocation,
  getAttendancePolicy,
  getLocations,
  updateAttendancePolicy,
  updateLocation,
} from "../controllers/locationController.js";

const router = express.Router();

router.get("/", authMiddleware, getLocations);
router.post("/", authMiddleware, addLocation);

// Policy routes must be declared before "/:id" so they are not captured as ids.
router.get("/policy", authMiddleware, getAttendancePolicy);
router.put("/policy", authMiddleware, updateAttendancePolicy);

router.put("/:id", authMiddleware, updateLocation);
router.delete("/:id", authMiddleware, deactivateLocation);

export default router;
