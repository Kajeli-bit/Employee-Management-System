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

// True when the user sees every department: company-level roles, plus
// department-scoped users explicitly granted company-wide access (e.g. HR).
// Works with both Mongoose documents and lean objects.
export const hasCompanyScope = (user) =>
  getRole(user?.role)?.scope === "company" || user?.companyScope === true;

// The Employee record behind the signed-in user. Managing directors created at
// registration have one, but callers must still handle null.
export const getActorEmployee = (user) =>
  Employee.findOne({
    userId: user._id,
    companyId: user.companyId,
  })
    .select("_id department workMode employmentStatus")
    .lean();

// A department manager also owns the teams inside their department.
export const departmentWithChildren = async (departmentId, companyId) => {
  if (!departmentId) {
    return [];
  }

  const teams = await Department.find({
    companyId,
    parent: departmentId,
  })
    .select("_id")
    .lean();

  return [departmentId, ...teams.map((team) => team._id)];
};

export const employeeScopeFilter = (user, actorEmployee, departmentIds) => {
  const role = getRole(user.role);

  if (!role) {
    return null;
  }

  if (role.scope === "company" || user?.companyScope === true) {
    return { companyId: user.companyId };
  }

  if (!actorEmployee) {
    return { companyId: user.companyId, _id: null };
  }

  if (role.scope === "self") {
    return {
      companyId: user.companyId,
      _id: actorEmployee._id,
    };
  }

  const ids =
    departmentIds && departmentIds.length > 0
      ? departmentIds
      : [actorEmployee.department].filter(Boolean);

  return {
    companyId: user.companyId,
    department: { $in: ids },
  };
};

// Roles whose people the user is allowed to see. Company-wide users (leadership
// and roles granted companyScope, such as HR) see every role including the ones
// above them; department-scoped users see only the roles they outrank.
export const visibleRoleKeys = (user) =>
  hasCompanyScope(user)
    ? [...ROLE_KEYS, ...LEGACY_ROLE_KEYS]
    : assignableRoles(user.role);

// The single source of truth for "which employees can this person see".
// Every page (directory, attendance, salary, leave) and the dashboard build
// their queries from this, so counts on the dashboard always match the rows on
// the page behind them.
export const accessibleEmployeeFilter = async (user) => {
  const actorEmployee = await getActorEmployee(user);

  const scopedDepartments = hasCompanyScope(user)
    ? []
    : await departmentWithChildren(
        actorEmployee?.department,
        user.companyId
      );

  const scope = employeeScopeFilter(user, actorEmployee, scopedDepartments);

  if (!scope) {
    return null;
  }

  // Same population the employee directory lists under the same rule.
  const visibleUsers = await User.find({
    companyId: user.companyId,
    $or: [{ role: { $in: visibleRoleKeys(user) } }, { _id: user._id }],
  })
    .select("_id")
    .lean();

  return {
    ...scope,
    userId: { $in: visibleUsers.map((entry) => entry._id) },
  };
};

const isSameDepartment = async (actorEmployee, targetDepartment) => {
  if (!actorEmployee?.department || !targetDepartment) {
    return false;
  }

  if (
    actorEmployee.department.toString() === targetDepartment.toString()
  ) {
    return true;
  }

  const department = await Department.findById(targetDepartment)
    .select("parent")
    .lean();

  return (
    department?.parent?.toString() === actorEmployee.department.toString()
  );
};

// Viewing follows the same rule as the directory: company-wide access sees the
// whole company (including people above them), department access sees only the
// roles they outrank inside their own department. Editing stays seniority-gated
// in canManageEmployee below.
export const canViewEmployee = async ({
  user,
  actorEmployee,
  targetEmployee,
  targetRole,
}) => {
  if (!targetEmployee) {
    return false;
  }

  if (
    targetEmployee.userId?.toString() === user._id.toString() ||
    targetEmployee.user?.toString() === user._id.toString()
  ) {
    return true;
  }

  const role = getRole(user.role);

  if (!role) {
    return false;
  }

  if (hasCompanyScope(user)) {
    return true;
  }

  if (roleLevel(user.role) < roleLevel(targetRole)) {
    return false;
  }

  return isSameDepartment(actorEmployee, targetEmployee.department);
};

export const canManageEmployee = async ({
  user,
  actorEmployee,
  targetEmployee,
  targetRole,
}) => {
  if (!targetEmployee) {
    return false;
  }

  if (!canManageRole(user.role, targetRole)) {
    return false;
  }

  const role = getRole(user.role);

  if (role?.scope === "company" || user?.companyScope === true) {
    return true;
  }

  return isSameDepartment(actorEmployee, targetEmployee.department);
};
