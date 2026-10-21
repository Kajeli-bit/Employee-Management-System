
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import Company from "../models/Company.js";
import Salary from "../models/Salary.js";
import Leave from "../models/Leave.js";
import Attendance from "../models/Attendance.js";

import {
  CAPABILITIES,
  canManageRole,
  hasCapability,
} from "../utils/roles.js";
import { localDateKey, DEFAULT_TIMEZONE } from "../utils/geo.js";

export const getDashboard = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const actorRole = req.user.role;
    const actorUserId = req.user._id;

    const companyUsers = await User.find({
      companyId,
    })
      .select("_id role")
      .lean();

    const accessibleUserIds = companyUsers
      .filter((user) => {
        if (
          user._id.toString() ===
          actorUserId.toString()
        ) {
          return true;
        }

        return canManageRole(
          actorRole,
          user.role
        );
      })
      .map((user) => user._id);

    const accessibleEmployees = await Employee.find({
      companyId,
      userId: {
        $in: accessibleUserIds,
      },
    })
      .select("_id")
      .lean();

    const accessibleEmployeeIds =
      accessibleEmployees.map(
        (employee) => employee._id
      );

    const canSeeSalaries = hasCapability(
      req.user.role,
      CAPABILITIES.SALARIES_VIEW
    );

    const canSeeAttendance = hasCapability(
      req.user.role,
      CAPABILITIES.ATTENDANCE_VIEW
    );

    const company = await Company.findById(companyId)
      .select("attendance")
      .lean();

    const timezone =
      company?.attendance?.timezone || DEFAULT_TIMEZONE;
    const today = localDateKey(new Date(), timezone);

    const [
      totalEmployees,
      totalDepartments,
      salaryStats,
      leaveStats,
      todayAttendance,
    ] = await Promise.all([
      Employee.countDocuments({
        companyId,
        userId: {
          $in: accessibleUserIds,
        },
      }),

      // Teams share the departments collection, so count only real
      // departments to match what the departments page lists.
      Department.countDocuments({
        companyId,
        kind: "department",
      }),

      Salary.aggregate([
        {
          $match: {
            companyId,
            employeeId: {
              $in: accessibleEmployeeIds,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalSalaryRecords: {
              $sum: 1,
            },
            totalSalaryPaid: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", "Paid"],
                  },
                  "$netSalary",
                  0,
                ],
              },
            },
          },
        },
      ]),

      Leave.aggregate([
        {
          $match: {
            companyId,
            employeeId: {
              $in: accessibleEmployeeIds,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalLeaves: {
              $sum: 1,
            },
            approvedLeaves: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", "Approved"],
                  },
                  1,
                  0,
                ],
              },
            },
            pendingLeaves: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", "Pending"],
                  },
                  1,
                  0,
                ],
              },
            },
            rejectedLeaves: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", "Rejected"],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      Attendance.find({
        companyId,
        date: today,
        employeeId: {
          $in: accessibleEmployeeIds,
        },
      })
        .select("status checkIn checkOut")
        .lean(),
    ]);

    // Salary totals are only returned to roles allowed to see payroll.
    const totalSalaryRecords = canSeeSalaries
      ? salaryStats[0]?.totalSalaryRecords || 0
      : 0;

    const totalSalaryPaid = canSeeSalaries
      ? salaryStats[0]?.totalSalaryPaid || 0
      : 0;

    const totalLeaves =
      leaveStats[0]?.totalLeaves || 0;

    const approvedLeaves =
      leaveStats[0]?.approvedLeaves || 0;

    const pendingLeaves =
      leaveStats[0]?.pendingLeaves || 0;

    const rejectedLeaves =
      leaveStats[0]?.rejectedLeaves || 0;

    const rawAttendanceSummary = {
      date: today,
      checkedIn: todayAttendance.filter((record) => record.checkIn?.at)
        .length,
      late: todayAttendance.filter((record) => record.status === "Late")
        .length,
      halfDay: todayAttendance.filter(
        (record) => record.status === "Half Day"
      ).length,
      onLeave: todayAttendance.filter(
        (record) => record.status === "On Leave"
      ).length,
      notCheckedIn: Math.max(
        0,
        totalEmployees -
          todayAttendance.filter((record) => record.checkIn?.at).length
      ),
    };

    const attendanceSummary = canSeeAttendance
      ? rawAttendanceSummary
      : {
          date: today,
          checkedIn: 0,
          late: 0,
          halfDay: 0,
          onLeave: 0,
          notCheckedIn: 0,
        };

    return res.status(200).json({
      success: true,
      dashboard: {
        totalEmployees,
        totalDepartments,
        totalSalaryRecords,
        totalLeaves,
        approvedLeaves,
        pendingLeaves,
        rejectedLeaves,
        totalSalaryPaid,
        attendance: attendanceSummary,
      },
    });
  } catch (error) {
    console.error(
      "Dashboard Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard data",
    });
  }
};



