import { roleLevel } from "./roles.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const digitsIn = (value) => String(value ?? "").replace(/\D/g, "");

// The same rules the server applies in utils/employeeProfile.js, so a typo is
// caught before a Clerk login is created.
export const validateWorker = ({ name, email, phone }) => {
  const errors = {};

  if (!String(name ?? "").trim()) {
    errors.name = "Enter the worker's full name.";
  }

  if (!emailPattern.test(String(email ?? "").trim())) {
    errors.email = "Enter a valid work email, like amina@nilric.co.tz.";
  }

  if (digitsIn(phone).length < 7) {
    errors.phone = "Enter a phone number with at least 7 digits.";
  }

  return errors;
};

// A team belongs to a department; both are stored in one collection, so walk
// up one level to find the unit the org chart treats as the parent.
export const parentDepartmentOf = (departments = [], departmentId) => {
  const department = departments.find((entry) => entry._id === departmentId);

  if (!department) {
    return null;
  }

  if (department.kind !== "team") {
    return department;
  }

  const parentId = department.parent?._id || department.parent;

  return departments.find((entry) => entry._id === parentId) || department;
};

// Picks the most senior person already in the selected department, preferring an
// exact team match over the parent department. It is only a suggestion: the
// manager can choose someone else, and the server still checks seniority.
export const suggestSupervisorFor = ({
  departments = [],
  supervisors = [],
  departmentId,
  role,
}) => {
  const parent = parentDepartmentOf(departments, departmentId);
  const candidates = supervisors.filter(
    (supervisor) => supervisor.level > roleLevel(role)
  );

  if (candidates.length === 0) {
    return "";
  }

  const exact = candidates.filter(
    (supervisor) => supervisor.department === departmentId
  );
  const inParent = candidates.filter(
    (supervisor) => parent && supervisor.department === parent._id
  );
  const pool = exact.length > 0 ? exact : inParent;

  if (pool.length === 0) {
    return "";
  }

  return [...pool].sort((a, b) => b.level - a.level)[0]._id;
};
