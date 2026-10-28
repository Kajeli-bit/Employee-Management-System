import { CAPABILITIES, hasCapability } from "../utils/roles.js";

export const isSuperUser = (user) => user?.accountType === "super_user";

export const canAdministerCompany = (user) =>
  isSuperUser(user) ||
  hasCapability(user?.role, CAPABILITIES.PEOPLE_VIEW);

export const requireSuperUser = (req, res, next) => {
  if (!isSuperUser(req.user)) {
    return res.status(403).json({ success: false, error: "Super-user access required" });
  }
  return next();
};

export const requireSecurityOversight = (req, res, next) => {
  if (!isSuperUser(req.user) && req.user?.securityOversight !== true) {
    return res.status(403).json({ success: false, error: "Security oversight access required" });
  }
  return next();
};
