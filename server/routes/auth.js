import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";

import {
  setupStatus,
  register,
  login,
  verify,
  updateEmail,
} from "../controllers/authController.js";

const router = express.Router();

router.get("/setup-status", setupStatus);

router.post("/register", register);

router.post("/login", login);

router.get("/verify", authMiddleware, verify);

router.put(
  "/update-email",
  authMiddleware,
  updateEmail
);

export default router;