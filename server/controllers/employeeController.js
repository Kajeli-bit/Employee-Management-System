import Employee from "../models/Employee.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Salary from "../models/Salary.js";
import Leave from "../models/Leave.js";

import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { clerkClient } from "@clerk/express";

import Attendance from "../models/Attendance.js";

import {
  CAPABILITIES,
  assignableRoles,
  canManageRole,
  hasCapability,
  isDepartmentScoped,
  isValidRole,
  roleLevel,
} from "../utils/roles.js";
import {
  canManageEmployee,
  canViewEmployee,
  departmentWithChildren,
  getActorEmployee,
} from "../utils/access.js";

// Fields added for the Nilric employee profile. Kept in one place so create and
// update stay in sync.
const PROFILE_FIELDS = [
  "employmentType",
  "employmentStatus",
  "dateOfJoining",
  "contractEndDate",
  "workMode",
  "phone",
  "personalEmail",
  "address",
  "city",
  "region",
  "nationalId",
  "tin",
  "nssfNumber",
  "bankName",
  "bankAccountName",
  "bankAccountNumber",
  "qualification",
  "fieldOfStudy",
  "notes",
];

const splitList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const readProfileFields = (body) => {
  const values = {};

  for (const field of PROFILE_FIELDS) {
    if (body[field] !== undefined && body[field] !== "") {
      values[field] = body[field];
    } else if (body[field] === "") {
      values[field] = undefined;
    }
  }

  if (body.certifications !== undefined) {
    values.certifications = splitList(body.certifications);
  }

  if (body.skills !== undefined) {
    values.skills = splitList(body.skills);
  }

  const emergencyName = body["emergencyContact.name"];
  const emergencyRelationship = body["emergencyContact.relationship"];
  const emergencyPhone = body["emergencyContact.phone"];

  if (emergencyName || emergencyRelationship || emergencyPhone) {
    values.emergencyContact = {
      name: emergencyName?.trim() || "",
      relationship: emergencyRelationship?.trim() || "",
      phone: emergencyPhone?.trim() || "",
    };
  }

  return values;
};

const validateReportsTo = async ({ reportsTo, companyId, targetRole }) => {
  if (!reportsTo) {
    return { value: null };
  }

  const supervisor = await User.findOne({
    _id: reportsTo,
    companyId,
  })
    .select("role name")
    .lean();

  if (!supervisor) {
    return { error: "Selected supervisor was not found in your company" };
  }

  if (roleLevel(supervisor.role) <= roleLevel(targetRole)) {
    return {
      error: `${supervisor.name} is not senior to the selected role. Pick a more senior supervisor.`,
    };
  }

  return { value: supervisor._id };
};

const storage = multer.memoryStorage();

export const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "ems/employees",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
};

const deleteFromCloudinary = async (publicId) => {
  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.log("CLOUDINARY DELETE ERROR:", error);
  }
};

export const addEmployee = async (req, res) => {
  let clerkUserId = null;
  let clerkUserWasCreated = false;
  let profileImagePublicId = "";

  try {
    if (!hasCapability(req.user.role, CAPABILITIES.PEOPLE_MANAGE)) {
      return res.status(403).json({
        success: false,
        error: "You are not allowed to add employees",
      });
    }

    const requestedRole = req.body.role || "employee";

    if (!isValidRole(requestedRole)) {
      return res.status(400).json({
        success: false,
        error: "Invalid employee role",
      });
    }

    if (!canManageRole(req.user.role, requestedRole)) {
      return res.status(403).json({
        success: false,
        error: "You can only create users below your role",
      });
    }

    const {
      name,
      username,
      email,
      employeeId,
      dob,
      gender,
      maritalStatus,
      designation,
      department,
      salary,
      reportsTo,
    } = req.body;

    if (
      !name ||
      !username ||
      !email ||
      !employeeId ||
      !department ||
      salary === undefined
    ) {
      return res.status(400).json({
        success: false,
        error: "Required employee fields are missing",
      });
    }

    const actorEmployee = await getActorEmployee(req.user);
    const profile = readProfileFields(req.body);

    const supervisor = await validateReportsTo({
      reportsTo,
      companyId: req.user.companyId,
      targetRole: requestedRole,
    });

    if (supervisor.error) {
      return res.status(400).json({
        success: false,
        error: supervisor.error,
      });
    }

    const employeeEmail = email.trim().toLowerCase();

    const userExists = await User.findOne({
      email: employeeEmail,
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        error: "User with this email already exists in EMS",
      });
    }

    const usernameExists = await User.findOne({
      username: username.trim(),
    });

    if (usernameExists) {
      return res.status(400).json({
        success: false,
        error: "Username already exists",
      });
    }

    const employeeIdExists = await Employee.findOne({
      employeeId: employeeId.trim(),
    });

    if (employeeIdExists) {
      return res.status(400).json({
        success: false,
        error: "Employee ID already exists",
      });
    }

    const departmentExists = await Department.findOne({
      _id: department,
      companyId: req.user.companyId,
    });

    if (!departmentExists) {
      return res.status(400).json({
        success: false,
        error: "Invalid department",
      });
    }

    // Department managers can only add people into their own department.
    if (isDepartmentScoped(req.user.role) && actorEmployee) {
      const allowedDepartments = await departmentWithChildren(
        actorEmployee.department,
        req.user.companyId
      );

      if (
        !allowedDepartments.some(
          (id) => id.toString() === departmentExists._id.toString()
        )
      ) {
        return res.status(403).json({
          success: false,
          error: "You can only add employees to your own department",
        });
      }
    }

    try {
      const existingClerkUsers =
        await clerkClient.users.getUserList({
          emailAddress: [employeeEmail],
        });

      if (existingClerkUsers.data.length > 0) {
        const existingClerkUser =
          existingClerkUsers.data[0];

        clerkUserId = existingClerkUser.id;
        clerkUserWasCreated = false;

        console.log(
          "EXISTING CLERK USER LINKED:",
          clerkUserId,
          employeeEmail
        );
      } else {
        const clerkUser =
          await clerkClient.users.createUser({
            emailAddress: [employeeEmail],
            firstName: name.trim(),
            skipPasswordRequirement: true,
          });

        clerkUserId = clerkUser.id;
        clerkUserWasCreated = true;

        console.log(
          "NEW CLERK EMPLOYEE CREATED:",
          clerkUserId,
          employeeEmail
        );
      }
    } catch (clerkError) {
      console.log(
        "CLERK EMPLOYEE CREATE/LOOKUP ERROR:",
        clerkError
      );

      return res.status(400).json({
        success: false,
        error:
          clerkError?.errors?.[0]?.longMessage ||
          clerkError?.errors?.[0]?.message ||
          "Unable to create or find employee login account",
      });
    }

    let profileImage = "";

    if (req.file) {
      try {
        const cloudinaryResult =
          await uploadToCloudinary(
            req.file.buffer
          );

        profileImage =
          cloudinaryResult.secure_url;

        profileImagePublicId =
          cloudinaryResult.public_id;
      } catch (cloudinaryError) {
        console.log(
          "CLOUDINARY UPLOAD ERROR:",
          cloudinaryError
        );

        if (
          clerkUserId &&
          clerkUserWasCreated
        ) {
          try {
            await clerkClient.users.deleteUser(
              clerkUserId
            );
          } catch (deleteError) {
            console.log(
              "CLERK ROLLBACK DELETE ERROR:",
              deleteError
            );
          }
        }

        return res.status(500).json({
          success: false,
          error: "Employee image upload failed",
        });
      }
    }

    const newUser = new User({
      clerkUserId,

      clerkUserCreatedByEMS:
        clerkUserWasCreated,

      name: name.trim(),

      username: username.trim(),

      email: employeeEmail,

      role: requestedRole,

      designation: designation?.trim() || "",

      companyId: req.user.companyId,

      dob,

      reportsTo: supervisor.value,

      profileImage,

      profileImagePublicId,
    });

    let savedUser;

    try {
      savedUser = await newUser.save();
    } catch (userError) {
      console.log(
        "MONGODB USER CREATE ERROR:",
        userError
      );

      if (profileImagePublicId) {
        await deleteFromCloudinary(
          profileImagePublicId
        );
      }

      if (
        clerkUserId &&
        clerkUserWasCreated
      ) {
        try {
          await clerkClient.users.deleteUser(
            clerkUserId
          );
        } catch (deleteError) {
          console.log(
            "CLERK ROLLBACK DELETE ERROR:",
            deleteError
          );
        }
      }

      throw userError;
    }

    try {
      const newEmployee = new Employee({
        userId: savedUser._id,

        companyId: req.user.companyId,

        createdBy: req.user._id,

        employeeId: employeeId.trim(),

        dob,

        gender,

        maritalStatus,

        designation: designation?.trim() || "",

        department,

        salary: Number(salary),

        ...profile,
      });

      await newEmployee.save();
    } catch (employeeError) {
      console.log(
        "MONGODB EMPLOYEE CREATE ERROR:",
        employeeError
      );

      await User.deleteOne({
        _id: savedUser._id,
      });

      if (profileImagePublicId) {
        await deleteFromCloudinary(
          profileImagePublicId
        );
      }

      if (
        clerkUserId &&
        clerkUserWasCreated
      ) {
        try {
          await clerkClient.users.deleteUser(
            clerkUserId
          );
        } catch (deleteError) {
          console.log(
            "CLERK ROLLBACK DELETE ERROR:",
            deleteError
          );
        }
      }

      throw employeeError;
    }

    return res.status(201).json({
      success: true,
      message:
        "User created successfully. User can login using the registered email and OTP.",
      employeeEmail,
      role: requestedRole,
    });
  } catch (error) {
    console.log("ADD EMPLOYEE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Server error while adding employee",
    });
  }
};

export const getEmployees = async (req, res) => {
  try {
    const accessibleRoles = assignableRoles(req.user.role);

    const page = Math.max(
      parseInt(req.query.page, 10) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        parseInt(req.query.limit, 10) || 10,
        1
      ),
      100
    );

    const skip = (page - 1) * limit;

    const search =
      req.query.search?.trim() || "";

    const roleFilter =
      req.query.role?.trim() || "";

    const departmentFilter =
      req.query.department?.trim() || "";

    const userQuery = {
      companyId: req.user.companyId,
      $or: [
        {
          role: {
            $in: accessibleRoles,
          },
        },
        {
          _id: req.user._id,
        },
      ],
    };

    if (roleFilter) {
      if (
        !isValidRole(roleFilter) ||
        (
          !accessibleRoles.includes(
            roleFilter
          ) &&
          roleFilter !== req.user.role
        )
      ) {
        return res.status(403).json({
          success: false,
          error:
            "You are not allowed to view users with this role",
        });
      }

      userQuery.role = roleFilter;
    }

    if (search) {
      userQuery.$and = [
        {
          $or: [
            {
              name: {
                $regex: search,
                $options: "i",
              },
            },
            {
              email: {
                $regex: search,
                $options: "i",
              },
            },
            {
              username: {
                $regex: search,
                $options: "i",
              },
            },
          ],
        },
      ];
    }

    const users = await User.find(
      userQuery
    )
      .select("-password")
      .lean();

    const userIds = users.map(
      (user) => user._id
    );

    const actorEmployee = await getActorEmployee(req.user);

    const scopedDepartments = isDepartmentScoped(req.user.role)
      ? await departmentWithChildren(
          actorEmployee?.department,
          req.user.companyId
        )
      : [];

    const employeeQuery = {
      companyId: req.user.companyId,
      userId: {
        $in: userIds,
      },
    };

    if (scopedDepartments.length > 0) {
      employeeQuery.department = { $in: scopedDepartments };
    }

    if (departmentFilter && scopedDepartments.length === 0) {
      const departmentExists =
        await Department.findOne({
          _id: departmentFilter,
          companyId: req.user.companyId,
        });

      if (!departmentExists) {
        return res.status(400).json({
          success: false,
          error: "Invalid department",
        });
      }

      employeeQuery.department =
        departmentFilter;
    }

    const total =
      await Employee.countDocuments(
        employeeQuery
      );

    const employees =
      await Employee.find(
        employeeQuery
      )
        .populate(
          "userId",
          "-password"
        )
        .populate("department")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean();

    const formatted =
      employees.map(
        (emp) => ({
          _id: emp._id,

          userId:
            emp.userId?._id,

          employeeId:
            emp.employeeId,

          name:
            emp.userId?.name ||
            "N/A",

          email:
            emp.userId?.email ||
            "N/A",

          username:
            emp.userId?.username ||
            "",

          profileImage:
            emp.userId?.profileImage ||
            "",

          dep_name:
            emp.department?.dep_name ||
            "Not Assigned",

          departmentId:
            emp.department?._id ||
            null,

          dob: emp.dob
            ? new Date(
                emp.dob
              ).toDateString()
            : "",

          gender:
            emp.gender,

          maritalStatus:
            emp.maritalStatus,

          designation:
            emp.designation,

          salary:
            emp.salary,

          role:
            emp.userId?.role ||
            "",

          employmentStatus:
            emp.employmentStatus || "Active",

          employmentType:
            emp.employmentType || "Full-time",

          workMode: emp.workMode || "Office",

          phone: emp.phone || "",

          dateOfJoining: emp.dateOfJoining || null,

          reportsTo: emp.userId?.reportsTo || null,
        })
      );

    const totalPages =
      Math.ceil(
        total / limit
      );

    return res.status(200).json({
      success: true,

      employees: formatted,

      pagination: {
        page,
        limit,
        total,
        totalPages,

        hasNextPage:
          page < totalPages,

        hasPreviousPage:
          page > 1,
      },
    });
  } catch (error) {
    console.log(
      "GET EMPLOYEES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Get employees server error",
    });
  }
};

export const getEmployee = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const employee =
      await Employee.findOne({
        _id: id,
        companyId:
          req.user.companyId,
      })
        .populate("userId", "-password")
        .populate("userId.reportsTo", "name designation role")
        .populate("department");

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    const targetRole =
      employee.userId?.role;

    if (!targetRole) {
      return res.status(403).json({
        success: false,
        error:
          "Employee role not available",
      });
    }

    const actorEmployee = await getActorEmployee(req.user);

    if (
      !(await canViewEmployee({
        user: req.user,
        actorEmployee,
        targetEmployee: {
          userId: employee.userId._id,
          department: employee.department?._id,
        },
        targetRole,
      }))
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You are not allowed to access this employee",
      });
    }

    return res.status(200).json({
      success: true,
      employee,
    });
  } catch (error) {
    console.log(
      "GET EMPLOYEE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Get employee server error",
    });
  }
};

export const updateEmployee = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const {
      employeeId,
      dob,
      gender,
      maritalStatus,
      designation,
      department,
      salary,
      role,
      reportsTo,
    } = req.body;

    const profile = readProfileFields(req.body);

    const employee =
      await Employee.findOne({
        _id: id,
        companyId:
          req.user.companyId,
      }).populate("userId");

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    if (
      employee.userId._id.toString() ===
      req.user._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Your own account cannot be changed here",
      });
    }

    const currentTargetRole =
      employee.userId.role;

    const actorEmployee = await getActorEmployee(req.user);

    if (
      !(await canManageEmployee({
        user: req.user,
        actorEmployee,
        targetEmployee: {
          userId: employee.userId._id,
          department: employee.department,
        },
        targetRole: currentTargetRole,
      }))
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You are not allowed to manage this user",
      });
    }

    const updatedRole =
      role || currentTargetRole;

    if (!isValidRole(updatedRole)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role",
      });
    }

    if (
      !canManageRole(
        req.user.role,
        updatedRole
      )
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You cannot assign this role",
      });
    }

    if (department) {
      const departmentExists =
        await Department.findOne({
          _id: department,
          companyId:
            req.user.companyId,
        });

      if (!departmentExists) {
        return res.status(400).json({
          success: false,
          error: "Invalid department",
        });
      }

      if (isDepartmentScoped(req.user.role) && actorEmployee) {
        const allowedDepartments = await departmentWithChildren(
          actorEmployee.department,
          req.user.companyId
        );

        if (
          !allowedDepartments.some(
            (id) => id.toString() === departmentExists._id.toString()
          )
        ) {
          return res.status(403).json({
            success: false,
            error:
              "You can only move employees within your own department",
          });
        }
      }
    }

    const supervisor = await validateReportsTo({
      reportsTo,
      companyId: req.user.companyId,
      targetRole: updatedRole,
    });

    if (supervisor.error) {
      return res.status(400).json({
        success: false,
        error: supervisor.error,
      });
    }

    let newProfileImage =
      employee.userId.profileImage ||
      "";

    let newProfileImagePublicId =
      employee.userId.profileImagePublicId ||
      "";

    if (req.file) {
      const cloudinaryResult =
        await uploadToCloudinary(
          req.file.buffer
        );

      newProfileImage =
        cloudinaryResult.secure_url;

      newProfileImagePublicId =
        cloudinaryResult.public_id;

      if (
        employee.userId
          .profileImagePublicId
      ) {
        await deleteFromCloudinary(
          employee.userId
            .profileImagePublicId
        );
      }
    }

    if (employeeId !== undefined) {
      employee.employeeId =
        employeeId.trim();
    }

    if (dob !== undefined) {
      employee.dob = dob;
    }

    if (gender !== undefined) {
      employee.gender = gender;
    }

    if (
      maritalStatus !== undefined
    ) {
      employee.maritalStatus =
        maritalStatus;
    }

    if (designation !== undefined) {
      employee.designation =
        designation.trim();
    }

    if (department !== undefined) {
      employee.department =
        department;
    }

    if (salary !== undefined) {
      employee.salary =
        Number(salary);
    }

    for (const [field, value] of Object.entries(profile)) {
      employee[field] = value;
    }

    employee.updatedAt =
      new Date();

    await employee.save();

    await User.findOneAndUpdate(
      {
        _id: employee.userId._id,
        companyId:
          req.user.companyId,
      },
      {
        role: updatedRole,

        reportsTo:
          supervisor.value !== null
            ? supervisor.value
            : employee.userId.reportsTo || null,

        designation:
          designation !== undefined
            ? designation.trim()
            : employee.userId.designation,

        dob:
          dob !== undefined
            ? dob
            : employee.userId.dob,

        profileImage:
          newProfileImage,

        profileImagePublicId:
          newProfileImagePublicId,

        updatedAt: new Date(),
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "User updated successfully",
      employee,
      role: updatedRole,
    });
  } catch (error) {
    console.log(
      "UPDATE EMPLOYEE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Update employee server error",
    });
  }
};

export const deleteEmployee = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const employee =
      await Employee.findOne({
        _id: id,
        companyId:
          req.user.companyId,
      });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    const employeeUser =
      await User.findOne({
        _id: employee.userId,
        companyId:
          req.user.companyId,
      });

    if (!employeeUser) {
      return res.status(404).json({
        success: false,
        error:
          "Employee user account not found",
      });
    }

    if (
      employeeUser._id.toString() ===
      req.user._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        error:
          "You cannot delete your own account",
      });
    }

    const actorEmployee = await getActorEmployee(req.user);

    if (
      !(await canManageEmployee({
        user: req.user,
        actorEmployee,
        targetEmployee: {
          userId: employeeUser._id,
          department: employee.department,
        },
        targetRole: employeeUser.role,
      }))
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You are not allowed to delete this user",
      });
    }

    await Attendance.deleteMany({
      employeeId: employee._id,
      companyId: req.user.companyId,
    });

    await Salary.deleteMany({
      employeeId: employee._id,
      companyId:
        req.user.companyId,
    });

    await Leave.deleteMany({
      employeeId: employee._id,
      companyId:
        req.user.companyId,
    });

    if (
      employeeUser.profileImagePublicId
    ) {
      await deleteFromCloudinary(
        employeeUser.profileImagePublicId
      );
    }

    if (employeeUser.clerkUserId) {
      if (
        employeeUser.clerkUserCreatedByEMS ===
        true
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
      } else {
        console.log(
          "CLERK USER NOT DELETED - EXISTING CLERK ACCOUNT:",
          employeeUser.clerkUserId
        );
      }
    }

    await User.findOneAndDelete({
      _id: employeeUser._id,
      companyId:
        req.user.companyId,
    });

    await Employee.deleteOne({
      _id: employee._id,
      companyId:
        req.user.companyId,
    });

    return res.status(200).json({
      success: true,
      message:
        "User and all related EMS data deleted successfully",
    });
  } catch (error) {
    console.log(
      "DELETE EMPLOYEE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Delete employee server error",
    });
  }
};

export const getEmployeeProfile = async (
  req,
  res
) => {
  try {
    const employee =
      await Employee.findOne({
        userId: req.user._id,
        companyId:
          req.user.companyId,
      })
        .populate("userId", "-password")
        .populate("userId.reportsTo", "name designation role")
        .populate("department");

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    return res.status(200).json({
      success: true,

      employee: {
        name:
          employee.userId.name,

        email:
          employee.userId.email,

        username:
          employee.userId.username,

        profileImage:
          employee.userId.profileImage,

        employeeId:
          employee.employeeId,

        department:
          employee.department?.dep_name,

        designation:
          employee.designation,

        gender:
          employee.gender,

        dob:
          employee.dob,

        maritalStatus:
          employee.maritalStatus,

        salary:
          employee.salary,

        role:
          employee.userId.role,

        reportsTo: employee.userId.reportsTo?._id || null,

        supervisorName: employee.userId.reportsTo?.name || "",

        supervisorRole: employee.userId.reportsTo?.role || "",

        employmentType: employee.employmentType,

        employmentStatus: employee.employmentStatus,

        workMode: employee.workMode,

        dateOfJoining: employee.dateOfJoining,

        contractEndDate: employee.contractEndDate,

        phone: employee.phone || "",

        personalEmail: employee.personalEmail || "",

        address: employee.address || "",

        city: employee.city || "",

        region: employee.region || "",

        nationalId: employee.nationalId || "",

        tin: employee.tin || "",

        nssfNumber: employee.nssfNumber || "",

        bankName: employee.bankName || "",

        bankAccountName: employee.bankAccountName || "",

        bankAccountNumber: employee.bankAccountNumber || "",

        emergencyContact: employee.emergencyContact || {},

        qualification: employee.qualification || "",

        fieldOfStudy: employee.fieldOfStudy || "",

        certifications: employee.certifications || [],

        skills: employee.skills || [],
      },
    });
  } catch (error) {
    console.log(
      "GET EMPLOYEE PROFILE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};