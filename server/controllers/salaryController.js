
import Salary from "../models/Salary.js";
import Employee from "../models/Employee.js";
import { canManageRole } from "../utils/roles.js";
import { isSuperUser } from "../middleware/superUser.js";
import {
  canManageEmployee,
  getActorEmployee,
} from "../utils/access.js";

const canManageSalaryEmployee = async (req, employeeId) => {
  const employee = await Employee.findOne({
    _id: employeeId,
    companyId: req.user.companyId,
  })
    .populate({
      path: "userId",
      select: "_id name role",
    });

  if (!employee) {
    return {
      allowed: false,
      employee: null,
      error: "Employee not found in your company",
    };
  }

  if (
    employee.userId?._id?.toString() ===
    req.user._id.toString()
  ) {
    return {
      allowed: false,
      employee,
      error: "You cannot manage your own salary",
    };
  }

  const targetRole = employee.userId?.role;

  if (!targetRole) {
    return {
      allowed: false,
      employee,
      error: "Employee role not found",
    };
  }

  const actorEmployee = await getActorEmployee(req.user);

  return {
    allowed: await canManageEmployee({
      user: req.user,
      actorEmployee,
      targetEmployee: employee,
      targetRole,
    }),
    employee,
    error:
      "You are not allowed to manage this employee's salary",
  };
};

export const addSalary = async (req, res) => {
  try {
    if (isSuperUser(req.user)) return res.status(403).json({ success: false, error: "Use the restricted security console for super-user actions" });
    const {
      employeeId,
      basicSalary,
      allowances,
      deductions,
      netSalary,
      payDate,
      status,
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: "Employee is required",
      });
    }

    if (
      basicSalary === undefined ||
      netSalary === undefined ||
      !payDate
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Basic salary, net salary and pay date are required",
      });
    }

    const basicSalaryValue = Number(basicSalary);
    const allowancesValue = Number(allowances || 0);
    const deductionsValue = Number(deductions || 0);
    const netSalaryValue = Number(netSalary);

    if (
      !Number.isFinite(basicSalaryValue) ||
      !Number.isFinite(allowancesValue) ||
      !Number.isFinite(deductionsValue) ||
      !Number.isFinite(netSalaryValue)
    ) {
      return res.status(400).json({
        success: false,
        error: "Salary values must be valid numbers",
      });
    }

    if (
      basicSalaryValue < 0 ||
      allowancesValue < 0 ||
      deductionsValue < 0 ||
      netSalaryValue < 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Salary values cannot be negative",
      });
    }

    if (
      status &&
      !["Paid", "Pending"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid salary status",
      });
    }

    const access =
      await canManageSalaryEmployee(
        req,
        employeeId
      );

    if (!access.employee) {
      return res.status(404).json({
        success: false,
        error: access.error,
      });
    }

    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        error: access.error,
      });
    }

    const salary = new Salary({
      employeeId,
      companyId: req.user.companyId,
      basicSalary: basicSalaryValue,
      allowances: allowancesValue,
      deductions: deductionsValue,
      netSalary: netSalaryValue,
      payDate,
      status: status || "Pending",
    });

    await salary.save();

    return res.status(201).json({
      success: true,
      message: "Salary added successfully",
      salary,
    });
  } catch (error) {
    console.log("ADD SALARY ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Server error while adding salary",
    });
  }
};

export const getSalaries = async (req, res) => {
  try {
    if (isSuperUser(req.user)) return res.status(403).json({ success: false, error: "Salary data is available only through an audited company export" });
    const salaries = await Salary.find({
      companyId: req.user.companyId,
    })
      .populate({
        path: "employeeId",
        select:
          "employeeId userId department",
        populate: [
          {
            path: "userId",
            select: "_id name role",
          },
          {
            path: "department",
            select: "dep_name",
          },
        ],
      })
      .sort({ payDate: -1 })
      .lean();

    const formatted = [];

    for (const salary of salaries) {
      const employee = salary.employeeId;
      const targetUser = employee?.userId;

      if (!targetUser) {
        continue;
      }

      const isSelf =
        targetUser._id.toString() ===
        req.user._id.toString();

      const canView =
        isSuperUser(req.user) || isSelf ||
        canManageRole(
          req.user.role,
          targetUser.role
        );

      if (!canView) {
        continue;
      }

      formatted.push({
        _id: salary._id,
        employeeId: employee.employeeId,
        employeeName:
          targetUser.name || "N/A",
        employeeRole:
          targetUser.role || "",
        department:
          employee.department?.dep_name ||
          "Not Assigned",
        basicSalary: salary.basicSalary,
        allowances: salary.allowances,
        deductions: salary.deductions,
        netSalary: salary.netSalary,
        payDate: salary.payDate
          ? new Date(
              salary.payDate
            ).toLocaleDateString("en-GB")
          : "",
        status: salary.status,
      });
    }

    return res.status(200).json({
      success: true,
      salaries: formatted,
    });
  } catch (error) {
    console.log(
      "GET SALARIES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Get salaries server error",
    });
  }
};

export const getSalary = async (
  req,
  res
) => {
  try {
    if (isSuperUser(req.user)) return res.status(403).json({ success: false, error: "Salary data is available only through an audited company export" });
    const { id } = req.params;

    const salary = await Salary.findOne({
      _id: id,
      companyId: req.user.companyId,
    })
      .populate({
        path: "employeeId",
        select:
          "employeeId userId department",
        populate: [
          {
            path: "userId",
            select: "_id name role",
          },
          {
            path: "department",
            select: "dep_name",
          },
        ],
      })
      .lean();

    if (!salary) {
      return res.status(404).json({
        success: false,
        error: "Salary not found",
      });
    }

    const targetUser =
      salary.employeeId?.userId;

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "Salary employee not found",
      });
    }

    const isSelf =
      targetUser._id.toString() ===
      req.user._id.toString();

    const canView =
      isSuperUser(req.user) || isSelf ||
      canManageRole(
        req.user.role,
        targetUser.role
      );

    if (!canView) {
      return res.status(403).json({
        success: false,
        error:
          "You are not allowed to view this salary",
      });
    }

    return res.status(200).json({
      success: true,
      salary,
    });
  } catch (error) {
    console.log(
      "GET SALARY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Get salary server error",
    });
  }
};

export const updateSalary = async (
  req,
  res
) => {
  try {
    if (isSuperUser(req.user)) return res.status(403).json({ success: false, error: "Super-user accounts do not manage payroll" });
    const { id } = req.params;

    const salary = await Salary.findOne({
      _id: id,
      companyId: req.user.companyId,
    }).populate({
      path: "employeeId",
      select: "employeeId userId",
      populate: {
        path: "userId",
        select: "_id name role",
      },
    });

    if (!salary) {
      return res.status(404).json({
        success: false,
        error: "Salary not found",
      });
    }

    const targetUser =
      salary.employeeId?.userId;

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "Salary employee not found",
      });
    }

    if (
      targetUser._id.toString() ===
      req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You cannot update your own salary",
      });
    }

    if (
      !isSuperUser(req.user) && !canManageRole(
        req.user.role,
        targetUser.role
      )
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You are not allowed to update this salary",
      });
    }

    if (salary.status === "Paid") {
      return res.status(400).json({
        success: false,
        error:
          "Salary is already paid. Cannot update.",
      });
    }

    const {
      basicSalary,
      allowances,
      deductions,
      netSalary,
      payDate,
      status,
    } = req.body;

    if (basicSalary !== undefined) {
      const value = Number(basicSalary);

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Basic salary must be a valid non-negative number",
        });
      }

      salary.basicSalary = value;
    }

    if (allowances !== undefined) {
      const value = Number(allowances);

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Allowances must be a valid non-negative number",
        });
      }

      salary.allowances = value;
    }

    if (deductions !== undefined) {
      const value = Number(deductions);

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Deductions must be a valid non-negative number",
        });
      }

      salary.deductions = value;
    }

    if (netSalary !== undefined) {
      const value = Number(netSalary);

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Net salary must be a valid non-negative number",
        });
      }

      salary.netSalary = value;
    }

    if (payDate !== undefined) {
      if (!payDate) {
        return res.status(400).json({
          success: false,
          error: "Pay date is required",
        });
      }

      salary.payDate = payDate;
    }

    if (status !== undefined) {
      if (
        !["Paid", "Pending"].includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid salary status",
        });
      }

      salary.status = status;
    }

    await salary.save();

    return res.status(200).json({
      success: true,
      salary,
      message:
        "Salary updated successfully",
    });
  } catch (error) {
    console.log(
      "UPDATE SALARY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Update salary server error",
    });
  }
};

export const deleteSalary = async (
  req,
  res
) => {
  try {
    if (isSuperUser(req.user)) return res.status(403).json({ success: false, error: "Super-user accounts do not manage payroll" });
    const { id } = req.params;

    const salary = await Salary.findOne({
      _id: id,
      companyId: req.user.companyId,
    }).populate({
      path: "employeeId",
      select: "employeeId userId",
      populate: {
        path: "userId",
        select: "_id name role",
      },
    });

    if (!salary) {
      return res.status(404).json({
        success: false,
        error: "Salary not found",
      });
    }

    const targetUser =
      salary.employeeId?.userId;

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "Salary employee not found",
      });
    }

    if (
      targetUser._id.toString() ===
      req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You cannot delete your own salary",
      });
    }

    if (
      !isSuperUser(req.user) && !canManageRole(
        req.user.role,
        targetUser.role
      )
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You are not allowed to delete this salary",
      });
    }

    await Salary.deleteOne({
      _id: salary._id,
      companyId: req.user.companyId,
    });

    return res.status(200).json({
      success: true,
      message:
        "Salary deleted successfully",
    });
  } catch (error) {
    console.log(
      "DELETE SALARY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Delete salary server error",
    });
  }
};

export const getSalaryHistory = async (
  req,
  res
) => {
  try {
    if (isSuperUser(req.user)) return res.status(403).json({ success: false, error: "Salary data is available only through an audited company export" });
    const { id } = req.params;

    const employee =
      await Employee.findOne({
        _id: id,
        companyId: req.user.companyId,
      })
        .populate({
          path: "userId",
          select: "_id name role",
        })
        .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    const targetUser = employee.userId;

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error:
          "Employee user not found",
      });
    }

    const isSelf =
      targetUser._id.toString() ===
      req.user._id.toString();

    const canView =
      isSuperUser(req.user) || isSelf ||
      canManageRole(
        req.user.role,
        targetUser.role
      );

    if (!canView) {
      return res.status(403).json({
        success: false,
        error:
          "You are not allowed to view this salary history",
      });
    }

    const salaries =
      await Salary.find({
        employeeId: employee._id,
        companyId: req.user.companyId,
      })
        .populate({
          path: "employeeId",
          select:
            "employeeId userId department",
          populate: [
            {
              path: "userId",
              select: "_id name role",
            },
            {
              path: "department",
              select: "dep_name",
            },
          ],
        })
        .sort({
          payDate: -1,
        })
        .lean();

    const formatted = salaries.map(
      (salary) => ({
        _id: salary._id,
        employeeId:
          salary.employeeId?._id,
        employeeCode:
          salary.employeeId?.employeeId,
        employeeName:
          salary.employeeId?.userId?.name ||
          "N/A",
        employeeRole:
          salary.employeeId?.userId?.role ||
          "",
        department:
          salary.employeeId?.department
            ?.dep_name ||
          "Not Assigned",
        basicSalary:
          salary.basicSalary,
        allowances:
          salary.allowances,
        deductions:
          salary.deductions,
        netSalary:
          salary.netSalary,
        payDate: salary.payDate
          ? new Date(
              salary.payDate
            ).toLocaleDateString(
              "en-GB"
            )
          : "",
        status:
          salary.status,
      })
    );

    return res.status(200).json({
      success: true,
      salaries: formatted,
    });
  } catch (error) {
    console.log(
      "GET SALARY HISTORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

export const getMySalary = async (
  req,
  res
) => {
  try {
    if (isSuperUser(req.user)) return res.status(200).json({ success: true, salaries: [] });
    const employee =
      await Employee.findOne({
        userId: req.user._id,
        companyId: req.user.companyId,
      }).lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    const salaries =
      await Salary.find({
        employeeId: employee._id,
        companyId: req.user.companyId,
      })
        .populate({
          path: "employeeId",
          select:
            "employeeId userId department",
          populate: [
            {
              path: "userId",
              select: "_id name role",
            },
            {
              path: "department",
              select: "dep_name",
            },
          ],
        })
        .sort({
          payDate: -1,
        })
        .lean();

    return res.status(200).json({
      success: true,
      salaries,
    });
  } catch (error) {
    console.log(
      "GET MY SALARY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

