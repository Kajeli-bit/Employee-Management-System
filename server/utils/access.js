import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import User from "../models/User.js";

import {
  LEGACY_ROLE_KEYS,
  ROLE_KEYS,
  assignableRoles,
  canManageRole,
  getRole,
  roleLevel,
} from "./roles.js";

export const hasCompanyScope = (user) =>
  user?.accountType === "super_user" ||
  getRole(user?.role)?.scope === "company" ||
  user?.companyScope === true;

// The Employee record behind a signed-in employee account. Standalone
// administrators intentionally have no employee record.
export const getActorEmployee = (user) =>
  Employee.findOne({ userId: user._id, companyId: user.companyId })
    .select("_id department workMode employmentStatus")
    .lean();

export const departmentWithChildren = async (departmentId, companyId) => {
  if (!departmentId) return [];
  const teams = await Department.find({ companyId, parent: departmentId })
    .select("_id")
    .lean();
  return [departmentId, ...teams.map((team) => team._id)];
};

export const employeeScopeFilter = (user, actorEmployee, departmentIds) => {
  const role = getRole(user.role);
  if (user?.accountType === "super_user") return { companyId: user.companyId };
  if (!role) return null;
  if (role.scope === "company" || user?.companyScope === true) return { companyId: user.companyId };
  if (!actorEmployee) return { companyId: user.companyId, _id: null };
  if (role.scope === "self") return { companyId: user.companyId, _id: actorEmployee._id };

  const ids = departmentIds?.length
    ? departmentIds
    : [actorEmployee.department].filter(Boolean);
  return { companyId: user.companyId, department: { $in: ids } };
};

export const visibleRoleKeys = (user) =>
  hasCompanyScope(user)
    ? [...ROLE_KEYS, ...LEGACY_ROLE_KEYS]
    : assignableRoles(user.role);

// This filter is for employees only. It cannot return a standalone super-user.
export const employeeDirectoryUserFilter = (user) => ({
  companyId: user.companyId,
  accountType: { $ne: "super_user" },
  $or: [{ role: { $in: visibleRoleKeys(user) } }, { _id: user._id }],
});

export const accessibleEmployeeFilter = async (user) => {
  if (user?.accountType === "super_user") return { companyId: user.companyId };

  const actorEmployee = await getActorEmployee(user);
  const scopedDepartments = hasCompanyScope(user)
    ? []
    : await departmentWithChildren(actorEmployee?.department, user.companyId);
  const scope = employeeScopeFilter(user, actorEmployee, scopedDepartments);
  if (!scope) return null;

  const visibleUsers = await User.find(employeeDirectoryUserFilter(user))
    .select("_id")
    .lean();

  return { ...scope, userId: { $in: visibleUsers.map((entry) => entry._id) } };
};

const isSameDepartment = async (actorEmployee, targetDepartment) => {
  if (!actorEmployee?.department || !targetDepartment) return false;
  if (actorEmployee.department.toString() === targetDepartment.toString()) return true;
  const department = await Department.findById(targetDepartment).select("parent").lean();
  return department?.parent?.toString() === actorEmployee.department.toString();
};

export const canViewEmployee = async ({ user, actorEmployee, targetEmployee, targetRole }) => {
  if (!targetEmployee) return false;
  if (user?.accountType === "super_user") return true;
  if (targetEmployee.userId?.toString() === user._id.toString() || targetEmployee.user?.toString() === user._id.toString()) return true;
  if (!getRole(user.role)) return false;
  if (hasCompanyScope(user)) return true;
  if (roleLevel(user.role) < roleLevel(targetRole)) return false;
  return isSameDepartment(actorEmployee, targetEmployee.department);
};

export const canManageEmployee = async ({ user, actorEmployee, targetEmployee, targetRole }) => {
  if (!targetEmployee) return false;
  if (user?.accountType === "super_user") return true;
  if (!canManageRole(user.role, targetRole)) return false;
  const role = getRole(user.role);
  if (role?.scope === "company" || user?.companyScope === true) return true;
  return isSameDepartment(actorEmployee, targetEmployee.department);
};
