import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import User from "../models/User.js";

import {
  getRole,
  publicRoleCatalog,
  roleLevel,
} from "../utils/roles.js";
import { jobTitlesForDepartments } from "../utils/orgDefaults.js";

export const getOrgStructure = async (req, res) => {
  try {
    const [departments, employees, users] = await Promise.all([
      Department.find({ companyId: req.user.companyId })
        .sort({ kind: 1, dep_name: 1 })
        .lean(),
      Employee.find({ companyId: req.user.companyId })
        .select("department userId workMode")
        .lean(),
      User.find({ companyId: req.user.companyId })
        .select("role reportsTo")
        .lean(),
    ]);

    const membersByDepartment = new Map();

    for (const employee of employees) {
      const key = employee.department?.toString();

      if (!key) {
        continue;
      }

      membersByDepartment.set(key, (membersByDepartment.get(key) || 0) + 1);
    }

    const membersByRole = users.reduce((counts, user) => {
      const role = getRole(user.role);

      if (role) {
        counts[role.key] = (counts[role.key] || 0) + 1;
      }

      return counts;
    }, {});

    const teamsByParent = new Map();

    for (const department of departments) {
      if (department.kind !== "team" || !department.parent) {
        continue;
      }

      const key = department.parent.toString();
      const teams = teamsByParent.get(key) || [];
      teams.push(department);
      teamsByParent.set(key, teams);
    }

    const departmentTree = departments
      .filter((department) => department.kind !== "team")
      .map((department) => ({
        _id: department._id,
        key: department.key || "",
        name: department.dep_name,
        description: department.description || "",
        memberCount: membersByDepartment.get(department._id.toString()) || 0,
        teams: (teamsByParent.get(department._id.toString()) || []).map(
          (team) => ({
            _id: team._id,
            key: team.key || "",
            name: team.dep_name,
            memberCount: membersByDepartment.get(team._id.toString()) || 0,
          })
        ),
      }));

    const departmentsById = new Map(
      departments.map((department) => [department._id.toString(), department])
    );

    return res.status(200).json({
      success: true,
      totalEmployees: employees.length,
      managementCount: users.filter(
        (user) => roleLevel(user.role) >= 60
      ).length,
      departmentTree,
      roles: publicRoleCatalog(),
      roleCounts: membersByRole,
      employeeDepartments: employees.map((employee) => ({
        department: departmentsById.get(employee.department?.toString())
          ?.dep_name,
        workMode: employee.workMode,
      })),
      jobTitles: jobTitlesForDepartments(),
    });
  } catch (error) {
    console.log("GET ORG STRUCTURE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load organisation structure",
    });
  }
};

// People who can be selected as a supervisor: same company, at the actor's
// level or above (so the Managing Director can appear as the General Manager's
// supervisor).
export const getSupervisors = async (req, res) => {
  try {
    const minimumLevel = Math.max(roleLevel(req.user.role), 60);

    const [users, employees] = await Promise.all([
      User.find({
        companyId: req.user.companyId,
      })
        .select("name designation role")
        .lean(),
      Employee.find({
        companyId: req.user.companyId,
      })
        .select("userId department")
        .lean(),
    ]);

    // The employee record holds the department, which lets the registration
    // form suggest the right reporting line when a department is chosen.
    const departmentByUser = new Map(
      employees.map((employee) => [
        employee.userId?.toString(),
        employee.department?.toString() || null,
      ])
    );

    const supervisors = users
      .filter(
        (user) =>
          user._id.toString() === req.user._id.toString() ||
          roleLevel(user.role) >= minimumLevel
      )
      .map((user) => ({
        _id: user._id,
        name: user.name,
        designation: user.designation,
        role: user.role,
        roleLabel: getRole(user.role)?.label || user.role,
        level: roleLevel(user.role),
        department: departmentByUser.get(user._id.toString()) || null,
      }))
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));

    return res.status(200).json({ success: true, supervisors });
  } catch (error) {
    console.log("GET SUPERVISORS ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load supervisors",
    });
  }
};
