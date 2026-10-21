import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import {
  getOrgStructure,
  getSupervisors,
} from "../controllers/orgController.js";

const router = express.Router();

router.get("/structure", authMiddleware, getOrgStructure);
router.get("/supervisors", authMiddleware, getSupervisors);

export default router;
