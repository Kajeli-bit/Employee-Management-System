import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import User from "../models/User.js";
import Salary from "../models/Salary.js";
import Leave from "../models/Leave.js";
import Attendance from "../models/Attendance.js";
import { clerkClient } from "@clerk/express";

import {
  CAPABILITIES,
  hasCapability,
} from "../utils/roles.js";

const canManageDepartments = (req, res) => {
  if (!hasCapability(req.user.role, CAPABILITIES.DEPARTMENTS_MANAGE)) {
    res.status(403).json({
      success: false,
      error: "Only company leadership can manage departments",
    });

    return false;
  }

  return true;
};

const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find({
      companyId: req.user.companyId,
    }).sort({
      dep_name: 1,
    });

    return res.status(200).json({
      success: true,
      departments,
    });
  } catch (error) {
    console.log("GET DEPARTMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Get department server error",
    });
  }
};

const addDepartment = async (req, res) => {
  try {
    if (!canManageDepartments(req, res)) {
      return undefined;
    }

    const { dep_name, description, kind, parent, teams } = req.body;

    if (!dep_name?.trim()) {
      return res.status(400).json({
        success: false,
        error: "Department name is required",
      });
    }

    const normalizedKind = kind === "team" ? "team" : "department";
    let parentId = null;

    if (normalizedKind === "team") {
      const parentDepartment = await Department.findOne({
        _id: parent,
        companyId: req.user.companyId,
        kind: "department",
      });

      if (!parentDepartment) {
        return res.status(400).json({
          success: false,
          error: "Select the department this team belongs to",
        });
      }

      parentId = parentDepartment._id;
    }

    const departmentName = dep_name.trim();

    const existingDepartment = await Department.findOne({
      companyId: req.user.companyId,
      dep_name: departmentName,
    });

    if (existingDepartment) {
      return res.status(400).json({
        success: false,
        error: "Department already exists",
      });
    }

    // Teams registered together with their department. Names are normalized
    // up front so a duplicate or blank entry fails before anything is saved.
    const teamNames = [];

    if (normalizedKind === "department" && teams !== undefined) {
      if (!Array.isArray(teams)) {
        return res.status(400).json({
          success: false,
          error: "Teams must be a list of names",
        });
      }

      for (const team of teams) {
        const name = typeof team === "string" ? team.trim() : team?.dep_name?.trim();

        if (!name) {
          return res.status(400).json({
            success: false,
            error: "Team names cannot be blank",
          });
        }

        teamNames.push(name);
      }

      if (new Set(teamNames).size !== teamNames.length) {
        return res.status(400).json({
          success: false,
          error: "Team names must be unique",
        });
      }

      if (teamNames.includes(departmentName)) {
        return res.status(400).json({
          success: false,
          error: "A team cannot share its department's name",
        });
      }

      const clashing = await Department.find({
        companyId: req.user.companyId,
        dep_name: { $in: teamNames },
      }).select("dep_name");

      if (clashing.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Already exists: ${clashing.map((entry) => entry.dep_name).join(", ")}`,
        });
      }
    }

    const newDepartment = new Department({
      dep_name: departmentName,
      description: description?.trim() || "",
      kind: normalizedKind,
      parent: parentId,
      companyId: req.user.companyId,
    });

    await newDepartment.save();

    const createdTeams = [];

    try {
      for (const name of teamNames) {
        const team = await new Department({
          dep_name: name,
          description: `${name} within ${departmentName}.`,
          kind: "team",
          parent: newDepartment._id,
          companyId: req.user.companyId,
        }).save();

        createdTeams.push(team);
      }
    } catch (teamError) {
      await Department.deleteMany({
        _id: { $in: createdTeams.map((team) => team._id) },
      });
      await Department.findByIdAndDelete(newDepartment._id);

      if (teamError?.code === 11000) {
        return res.status(400).json({
          success: false,
          error: "A team name is already in use",
        });
      }

      throw teamError;
    }

    return res.status(201).json({
      success: true,
      department: newDepartment,
      teams: createdTeams,
    });
  } catch (error) {
    console.log("ADD DEPARTMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Add department server error",
    });
  }
};

const getDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findOne({
      _id: id,
      companyId: req.user.companyId,
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        error: "Department not found",
      });
    }

    const teams = await Department.find({
      companyId: req.user.companyId,
      parent: department._id,
    }).sort({ dep_name: 1 });

    // Employee counts so the UI can guard team removal: deleting a team
    // cascades to its employee records, so staffed teams stay put.
    const teamsWithCounts = await Promise.all(
      teams.map(async (team) => ({
        ...team.toObject(),
        employeeCount: await Employee.countDocuments({
          companyId: req.user.companyId,
          department: team._id,
        }),
      }))
    );

    return res.status(200).json({
      success: true,
      department: {
        ...department.toObject(),
        employeeCount: await Employee.countDocuments({
          companyId: req.user.companyId,
          department: department._id,
        }),
      },
      teams: teamsWithCounts,
    });
  } catch (error) {
    console.log("GET DEPARTMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Get department server error",
    });
  }
};

const updateDepartment = async (req, res) => {
  try {
    if (!canManageDepartments(req, res)) {
      return undefined;
    }

    const { id } = req.params;
    const { dep_name, description, kind, parent } = req.body;

    if (!dep_name?.trim()) {
      return res.status(400).json({
        success: false,
        error: "Department name is required",
      });
    }

    const normalizedKind = kind === "team" ? "team" : "department";
    let parentId = null;

    if (normalizedKind === "team") {
      const parentDepartment = await Department.findOne({
        _id: parent,
        companyId: req.user.companyId,
        kind: "department",
      });

      if (!parentDepartment) {
        return res.status(400).json({
          success: false,
          error: "Select the department this team belongs to",
        });
      }

      parentId = parentDepartment._id;
    }

    const departmentName = dep_name.trim();

    const duplicateDepartment = await Department.findOne({
      companyId: req.user.companyId,
      dep_name: departmentName,
      _id: {
        $ne: id,
      },
    });

    if (duplicateDepartment) {
      return res.status(400).json({
        success: false,
        error: "Department already exists",
      });
    }

    const department = await Department.findOneAndUpdate(
      {
        _id: id,
        companyId: req.user.companyId,
      },
      {
        dep_name: departmentName,
        description: description?.trim() || "",
        kind: normalizedKind,
        parent: parentId,
        updatedAt: new Date(),
      },
      {
        returnDocument: "after",
      }
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        error: "Department not found",
      });
    }

    return res.status(200).json({
      success: true,
      department,
    });
  } catch (error) {
    console.log("UPDATE DEPARTMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Edit department server error",
    });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    if (!canManageDepartments(req, res)) {
      return undefined;
    }

    const { id } = req.params;

    const department = await Department.findOne({
      _id: id,
      companyId: req.user.companyId,
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        error: "Department not found",
      });
    }

    const childTeams = await Department.countDocuments({
      parent: id,
      companyId: req.user.companyId,
    });

    if (childTeams > 0) {
      return res.status(400).json({
        success: false,
        error:
          "This department still has teams. Delete or move the teams first.",
      });
    }

    const employees = await Employee.find({
      department: id,
      companyId: req.user.companyId,
    });

    for (const employee of employees) {
      await Salary.deleteMany({
        employeeId: employee._id,
        companyId: req.user.companyId,
      });

      await Leave.deleteMany({
        employeeId: employee._id,
        companyId: req.user.companyId,
      });

      await Attendance.deleteMany({
        employeeId: employee._id,
        companyId: req.user.companyId,
      });

      const employeeUser = await User.findOne({
        _id: employee.userId,
        companyId: req.user.companyId,
      });

      if (
        employeeUser?.clerkUserId &&
        employeeUser.clerkUserCreatedByEMS === true
      ) {
        try {
          await clerkClient.users.deleteUser(
            employeeUser.clerkUserId
          );

          console.log(
            "CLERK USER DELETED:",
            employeeUser.clerkUserId
          );
        } catch (clerkError) {
          console.log(
            "DELETE CLERK USER ERROR:",
            clerkError
          );
        }
      }

      await User.findOneAndDelete({
        _id: employee.userId,
        companyId: req.user.companyId,
      });

      await Employee.deleteOne({
        _id: employee._id,
        companyId: req.user.companyId,
      });
    }

    await Department.deleteOne({
      _id: id,
      companyId: req.user.companyId,
    });

    return res.status(200).json({
      success: true,
      message: "Department and all related records deleted successfully",
    });
  } catch (error) {
    console.log("DELETE DEPARTMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Delete department server error",
    });
  }
};

export {
  addDepartment,
  getDepartments,
  getDepartment,
  updateDepartment,
  deleteDepartment,
};