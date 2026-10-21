import Department from "../models/Department.js";
import Employee from "../models/Employee.js";

import { canManageRole, getRole, roleLevel } from "./roles.js";

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

  if (role.scope === "company") {
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

// Department managers and team leads only see their own department (and its
// teams); company level roles see everyone at or below their level.
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

  if (roleLevel(user.role) < roleLevel(targetRole)) {
    return false;
  }

  if (role.scope === "company") {
    return true;
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

  if (role?.scope === "company") {
    return true;
  }

  return isSameDepartment(actorEmployee, targetEmployee.department);
};
