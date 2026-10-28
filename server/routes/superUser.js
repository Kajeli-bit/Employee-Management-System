import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";
import { getAuth } from "@clerk/express";
import { requireSecurityOversight, requireSuperUser } from "../middleware/superUser.js";
import {
  bootstrapSuperUser,
  exportCompanyData,
  getSecurityOverview,
  identifySuperUser,
  recoverAccount,
} from "../controllers/superUserController.js";

const router = express.Router();

// Protected by a server-held bootstrap key plus a verified Clerk identity.
router.post("/bootstrap", (req, res, next) => {
  if (!getAuth(req).userId) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  return next();
}, bootstrapSuperUser);
router.get("/me", authMiddleware, identifySuperUser);
router.get("/overview", authMiddleware, requireSecurityOversight, getSecurityOverview);
router.post("/accounts/:userId/recovery", authMiddleware, requireSuperUser, recoverAccount);
router.post("/export", authMiddleware, requireSuperUser, exportCompanyData);

export default router;
