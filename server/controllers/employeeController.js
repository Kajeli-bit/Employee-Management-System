import Employee from "../models/Employee.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Salary from "../models/Salary.js";
import Leave from "../models/Leave.js";

import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { clerkClient } from "@clerk/express";

import Attendance from "../models/Attendance.js";
import WorkLocation from "../models/WorkLocation.js";

import {
  CAPABILITIES,
  canManageRole,
  hasCapability,
  isDepartmentScoped,
  isValidRole,
  roleFilterAliases,
  roleLevel,
  designationForRole,
  roleForDesignation,
  resolveRole,
} from "../utils/roles.js";
import {
  canManageEmployee,
  canViewEmployee,
  employeeDirectoryUserFilter,
  departmentWithChildren,
  getActorEmployee,
  visibleRoleKeys,
} from "../utils/access.js";
import {
  asBoolean,
  canGrantCompanyScope,
  employeeIdSeed,
  missingEmployeeEssentials,
  parseOptionalSalary,
  readProfileFields,
  usernameFromEmail,
} from "../utils/employeeProfile.js";

// Generated identifiers must not collide with an existing account.
const uniqueUsername = async (base) => {
  let candidate = base;
  let suffix = 1;

  while (await User.exists({ username: candidate })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }

  return candidate;
};

const uniqueEmployeeId = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = employeeIdSeed();

    if (!(await Employee.exists({ employeeId: candidate }))) {
      return candidate;
    }
  }

  return `NIL-${Date.now()}`;
};

// Resolves the home site a manager picked. An empty value clears the field.
const resolveWorkLocation = async ({ value, companyId }) => {
  if (value === undefined) {
    return { value: undefined };
  }

  if (value === "" || value === null) {
    return { value: null };
  }

  // A malformed id would throw a cast error and surface as a 500; treat it as
  // an unknown site instead.
  if (!/^[0-9a-fA-F]{24}$/.test(String(value))) {
    return { error: "Selected work location was not found in your company" };
  }

  const location = await WorkLocation.findOne({
    _id: value,
    companyId,
  })
    .select("_id")
    .lean();

  if (!location) {
    return { error: "Selected work location was not found in your company" };
  }

  return { value: location._id };
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

// `options.clerk` lets tests inject a Clerk double. Production callers pass
// only the request and response, so the real client is used.
export const addEmployee = async (req, res, options = {}) => {
  const clerk = options.clerk || clerkClient;
  if (req.user.accountType === "super_user") return res.status(403).json({ success: false, error: "Super-user accounts cannot create employee identities" });

  let clerkUserId = null;
  let clerkUserWasCreated = false;
  let clerkPersonalEmailAddressId = null;
  let personalEmailNeedsVerification = false;
  let profileImagePublicId = "";

  const rollbackClerkChanges = async () => {
    try {
      if (clerkUserWasCreated && clerkUserId) {
        await clerk.users.deleteUser(clerkUserId);
      } else if (clerkPersonalEmailAddressId) {
        await clerk.emailAddresses.deleteEmailAddress(
          clerkPersonalEmailAddressId
        );
      }
    } catch (rollbackError) {
      console.log("CLERK EMPLOYEE ROLLBACK ERROR:", rollbackError);
    }
  };

  try {
    if (!hasCapability(req.user.role, CAPABILITIES.PEOPLE_MANAGE)) {

      return res.status(403).json({
        success: false,
        error: "You are not allowed to add employees",
      });
    }

    // Onboarding creates a worker unless a role is chosen explicitly.
    const requestedDesignationRole = roleForDesignation(
      String(req.body.designation || "").trim()
    );
    const requestedRole = req.body.role
      ? resolveRole(req.body.role)
      : requestedDesignationRole || "worker";

    if (req.body.role && !requestedRole) {
      return res.status(400).json({
        success: false,
        error: "Invalid employee role",
      });
    }

    if (
      req.body.role &&
      req.body.designation &&
      requestedDesignationRole !== requestedRole
    ) {
      return res.status(400).json({
        success: false,
        error: "Designation must match the selected role",
      });
    }

    if (!isValidRole(requestedRole)) {
      return res.status(400).json({
        success: false,
        error: "Invalid employee role",
      });
    }

    if (req.user.accountType === "super_user" || !canManageRole(req.user.role, requestedRole)) {
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

    // Onboarding asks for a name, work email and phone number. Everything else
    // is either generated below or can be added later.
    const missing = missingEmployeeEssentials({
      name,
      email,
      phone: req.body.phone,
    });

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Add the employee's ${missing.join(", ")} to create the account.`,
      });
    }

    const salaryResult = parseOptionalSalary(salary);

    if (salaryResult.error) {
      return res.status(400).json({
        success: false,
        error: salaryResult.error,
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

    // Company-wide visibility is only for department-scoped roles and only
    // leadership may hand it out.
    const requestedCompanyScope = asBoolean(req.body.companyScope, false);

    if (
      requestedCompanyScope &&
      !canGrantCompanyScope(req.user)
    ) {
      return res.status(403).json({
        success: false,
        error:
          "Only company leadership can grant company-wide visibility",
      });
    }

    const homeSite = await resolveWorkLocation({
      value: req.body.workLocation,
      companyId: req.user.companyId,
    });

    if (homeSite.error) {
      return res.status(400).json({
        success: false,
        error: homeSite.error,
      });
    }

    const employeeEmail = email.trim().toLowerCase();
    const personalEmail = String(req.body.personalEmail || "")
      .trim()
      .toLowerCase();
    profile.personalEmail = personalEmail || undefined;

    if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
      return res.status(400).json({
        success: false,
        error: "Enter a valid personal email address",
      });
    }

    if (personalEmail && personalEmail === employeeEmail) {
      return res.status(400).json({
        success: false,
        error: "Personal email must be different from work email",
      });
    }

    const existingUserEmailQuery = [{ email: employeeEmail }];

    if (personalEmail) {
      existingUserEmailQuery.push(
        { email: personalEmail },
        { personalEmail }
      );
    }

    const userExists = await User.findOne({
      $or: existingUserEmailQuery,
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        error: "User with this email already exists in EMS",
      });
    }

    // A username can be typed in, but is otherwise derived from the work email.
    const providedUsername = String(username || "").trim();
    let finalUsername = providedUsername || usernameFromEmail(employeeEmail);

    if (providedUsername) {
      if (await User.exists({ username: providedUsername })) {
        return res.status(400).json({
          success: false,
          error: "Username already exists",
        });
      }
    } else {
      finalUsername = await uniqueUsername(finalUsername);
    }

    // Same for the staff ID.
    const providedEmployeeId = String(employeeId || "").trim();
    let finalEmployeeId = providedEmployeeId;

    if (providedEmployeeId) {
      if (await Employee.exists({ employeeId: providedEmployeeId })) {
        return res.status(400).json({
          success: false,
          error: "Employee ID already exists",
        });
      }
    } else {
      finalEmployeeId = await uniqueEmployeeId();
    }

    // The department is optional: a new worker can be placed later.
    let verifiedDepartment = null;

    if (department) {
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

      verifiedDepartment = departmentExists._id;
    }

    // Department managers can only add people into their own department.
    if (
      verifiedDepartment &&
      isDepartmentScoped(req.user.role) &&
      !req.user.companyScope &&
      actorEmployee
    ) {
      const allowedDepartments = await departmentWithChildren(
        actorEmployee.department,
        req.user.companyId
      );

      if (
        !allowedDepartments.some(
          (id) => id.toString() === verifiedDepartment.toString()
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
        await clerk.users.getUserList({
          emailAddress: [employeeEmail],
        });

      if (existingClerkUsers.data.length > 0) {
        const existingClerkUser = existingClerkUsers.data[0];

        clerkUserId = existingClerkUser.id;
        clerkUserWasCreated = false;

        console.log(
          "EXISTING CLERK USER LINKED:",
          clerkUserId,
          employeeEmail
        );
      } else {
        const clerkUser =
          await clerk.users.createUser({
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

      if (personalEmail) {
        const personalEmailOwner = await clerk.users.getUserList({
          emailAddress: [personalEmail],
        });
        const belongsToAnotherClerkUser = personalEmailOwner.data.some(
          (candidate) => candidate.id !== clerkUserId
        );

        if (belongsToAnotherClerkUser) {
          await rollbackClerkChanges();
          clerkUserId = null;
          clerkUserWasCreated = false;

          return res.status(409).json({
            success: false,
            error: "Personal email is already linked to another login account",
          });
        }

        const clerkUser = await clerk.users.getUser(clerkUserId);
        const attachedAddress = clerkUser.emailAddresses?.find(
          (address) => address.emailAddress?.trim().toLowerCase() === personalEmail
        );

        if (attachedAddress?.verification?.status === "verified") {
          personalEmailNeedsVerification = false;
        } else if (!attachedAddress) {
          personalEmailNeedsVerification = true;
          const personalAddress = await clerk.emailAddresses.createEmailAddress({
            userId: clerkUserId,
            emailAddress: personalEmail,
            primary: false,
            verified: false,
          });
          clerkPersonalEmailAddressId = personalAddress.id;
        } else {
          personalEmailNeedsVerification = true;
        }
      }
    } catch (clerkError) {
      await rollbackClerkChanges();
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

        await rollbackClerkChanges();

        return res.status(500).json({
          success: false,
          error: "Employee image upload failed",
        });
      }
    }

    const newUser = new User({
      clerkUserId,
      accountType: "employee",

      clerkUserCreatedByEMS:
        clerkUserWasCreated,

      name: name.trim(),

      username: finalUsername,

      email: employeeEmail,

      personalEmail,

      role: requestedRole,

      designation: designationForRole(requestedRole),

      companyId: req.user.companyId,

      dob,

      reportsTo: supervisor.value,

      companyScope: requestedCompanyScope,

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

      await rollbackClerkChanges();

      throw userError;
    }

    try {
      const newEmployee = new Employee({
        userId: savedUser._id,

        companyId: req.user.companyId,

        createdBy: req.user._id,

        employeeId: finalEmployeeId,

        dob,

        gender,

        maritalStatus,

        designation: designationForRole(requestedRole),

        department: verifiedDepartment,

        salary: salaryResult.value,

        workLocation: homeSite.value ?? null,

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

      await rollbackClerkChanges();

      throw employeeError;
    }

    return res.status(201).json({
      success: true,
      message:
        "User created successfully. User can login using the registered email and OTP.",
      employeeEmail,
      personalEmail,
      personalEmailVerificationRequired: personalEmailNeedsVerification,
      employeeId: finalEmployeeId,
      username: finalUsername,
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
    if (req.user.accountType === "super_user") return res.status(403).json({ success: false, error: "Use the restricted security console for super-user actions" });
    // Same rule the dashboard and attendance register use, so the counts always
    // match the rows listed here.
    const accessibleRoles = visibleRoleKeys(req.user);

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

    const userQuery = employeeDirectoryUserFilter(req.user);

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

      // Accounts created before the three-role model still store a retired key,
      // so filtering by "HR" must also match a stored department_manager.
      userQuery.role = { $in: roleFilterAliases(roleFilter) };
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

    const scopedDepartments =
      isDepartmentScoped(req.user.role) && !req.user.companyScope
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
        .populate("workLocation", "name")
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

          personalEmail:
            emp.personalEmail || emp.userId?.personalEmail || "",

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

          workLocation: emp.workLocation?.name || "",

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
    if (req.user.accountType === "super_user") return res.status(403).json({ success: false, error: "Super-user accounts do not use employee profiles" });
    const { id } = req.params;

    const employee =
      await Employee.findOne({
        _id: id,
        companyId:
          req.user.companyId,
      })
        .populate("userId", "-password")
        .populate("userId.reportsTo", "name designation role")
        .populate("department")
        .populate("workLocation", "name address radiusMeters isActive");

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
  let newlyAddedClerkEmailId = null;
  if (req.user.accountType === "super_user") return res.status(403).json({ success: false, error: "Super-user accounts do not edit employee profiles" });

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
    const personalEmailWasSubmitted = Object.prototype.hasOwnProperty.call(
      req.body,
      "personalEmail"
    );
    const requestedPersonalEmail = personalEmailWasSubmitted
      ? String(req.body.personalEmail || "").trim().toLowerCase()
      : undefined;

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

    const requestedDesignationRole =
      designation !== undefined
        ? roleForDesignation(String(designation).trim())
        : null;
    const requestedRole = role !== undefined ? resolveRole(role) : null;

    if (role !== undefined && !requestedRole) {
      return res.status(400).json({
        success: false,
        error: "Invalid role",
      });
    }

    const updatedRole =
      requestedRole || requestedDesignationRole || currentTargetRole;

    if (
      requestedRole &&
      requestedDesignationRole &&
      requestedRole !== requestedDesignationRole
    ) {
      return res.status(400).json({
        success: false,
        error: "Designation must match the selected role",
      });
    }

    if (designation !== undefined && !requestedDesignationRole) {
      return res.status(400).json({
        success: false,
        error: "Choose one of the three supported designations",
      });
    }

    if (!isValidRole(updatedRole)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role",
      });
    }

    if (
      req.user.accountType === "super_user" ||
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

      if (
        isDepartmentScoped(req.user.role) &&
        !req.user.companyScope &&
        actorEmployee
      ) {
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

    if (personalEmailWasSubmitted) {
      if (
        requestedPersonalEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedPersonalEmail)
      ) {
        return res.status(400).json({
          success: false,
          error: "Enter a valid personal email address",
        });
      }

      if (
        requestedPersonalEmail &&
        requestedPersonalEmail === employee.userId.email.trim().toLowerCase()
      ) {
        return res.status(400).json({
          success: false,
          error: "Personal email must be different from work email",
        });
      }

      if (requestedPersonalEmail) {
        const [emailOwner, employeeEmailOwner] = await Promise.all([
          User.findOne({
            _id: { $ne: employee.userId._id },
            $or: [
              { email: requestedPersonalEmail },
              { personalEmail: requestedPersonalEmail },
            ],
          }).select("_id"),
          Employee.findOne({
            userId: { $ne: employee.userId._id },
            personalEmail: requestedPersonalEmail,
          }).select("_id"),
        ]);

        if (emailOwner || employeeEmailOwner) {
          return res.status(409).json({
            success: false,
            error: "This email is already assigned to another account",
          });
        }
      }

      const currentPersonalEmail = String(
        employee.userId.personalEmail || employee.personalEmail || ""
      )
        .trim()
        .toLowerCase();

      if (requestedPersonalEmail !== currentPersonalEmail && requestedPersonalEmail) {
        if (!employee.userId.clerkUserId) {
          return res.status(409).json({
            success: false,
            error: "This account has no Clerk login to attach the personal email to",
          });
        }

        const matchingClerkUsers = await clerkClient.users.getUserList({
          emailAddress: [requestedPersonalEmail],
        });
        const otherClerkOwner = matchingClerkUsers.data.some(
          (candidate) => candidate.id !== employee.userId.clerkUserId
        );

        if (otherClerkOwner) {
          return res.status(409).json({
            success: false,
            error: "This email is already linked to another login account",
          });
        }

        const clerkUser = await clerkClient.users.getUser(
          employee.userId.clerkUserId
        );
        const existingClerkEmail = clerkUser.emailAddresses?.find(
          (address) =>
            address.emailAddress?.trim().toLowerCase() === requestedPersonalEmail
        );

        if (!existingClerkEmail) {
          const addedEmail = await clerkClient.emailAddresses.createEmailAddress({
            userId: employee.userId.clerkUserId,
            emailAddress: requestedPersonalEmail,
            primary: false,
            verified: false,
          });
          newlyAddedClerkEmailId = addedEmail.id;
        }
      }

      profile.personalEmail = requestedPersonalEmail || undefined;
    }

    const canSetCompanyScope = canGrantCompanyScope(req.user);
    const requestedCompanyScope = asBoolean(req.body.companyScope, false);

    if (requestedCompanyScope && !canSetCompanyScope) {
      return res.status(403).json({
        success: false,
        error:
          "Only company leadership can grant company-wide visibility",
      });
    }

    const homeSite = await resolveWorkLocation({
      value: req.body.workLocation,
      companyId: req.user.companyId,
    });

    if (homeSite.error) {
      return res.status(400).json({
        success: false,
        error: homeSite.error,
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

    employee.designation = designationForRole(updatedRole);

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

    if (homeSite.value !== undefined) {
      employee.workLocation = homeSite.value;
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

        designation: designationForRole(updatedRole),

        dob:
          dob !== undefined
            ? dob
            : employee.userId.dob,

        profileImage:
          newProfileImage,

        profileImagePublicId:
          newProfileImagePublicId,

        ...(personalEmailWasSubmitted
          ? requestedPersonalEmail
            ? { personalEmail: requestedPersonalEmail }
            : { $unset: { personalEmail: 1 } }
          : {}),

        // Only leadership edits this flag, so a department manager saving the
        // form cannot silently drop a grant someone else made.
        ...(canSetCompanyScope && req.body.companyScope !== undefined
          ? { companyScope: requestedCompanyScope }
          : {}),

        updatedAt: new Date(),
      }
    );

    if (newlyAddedClerkEmailId) {
      newlyAddedClerkEmailId = null;
    }

    const previousPersonalEmail = String(
      employee.userId.personalEmail || ""
    )
      .trim()
      .toLowerCase();

    if (
      personalEmailWasSubmitted &&
      previousPersonalEmail &&
      previousPersonalEmail !== requestedPersonalEmail &&
      employee.userId.clerkUserId
    ) {
      try {
        const clerkUser = await clerkClient.users.getUser(
          employee.userId.clerkUserId
        );
        const previousAddress = clerkUser.emailAddresses?.find(
          (address) =>
            address.emailAddress?.trim().toLowerCase() === previousPersonalEmail &&
            address.id !== clerkUser.primaryEmailAddressId
        );

        if (previousAddress) {
          await clerkClient.emailAddresses.deleteEmailAddress(previousAddress.id);
        }
      } catch (clerkError) {
        console.log("OLD CLERK PERSONAL EMAIL CLEANUP ERROR:", clerkError);
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "User updated successfully",
      employee,
      role: updatedRole,
    });
  } catch (error) {
    if (newlyAddedClerkEmailId) {
      try {
        await clerkClient.emailAddresses.deleteEmailAddress(
          newlyAddedClerkEmailId
        );
      } catch (cleanupError) {
        console.log("NEW CLERK PERSONAL EMAIL CLEANUP ERROR:", cleanupError);
      }
    }

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
    if (req.user.accountType === "super_user") return res.status(403).json({ success: false, error: "Super-user accounts do not delete employees" });
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
        .populate("department")
        .populate("workLocation", "name address");

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

        probationEndDate: employee.probationEndDate || null,

        workLocation: employee.workLocation?._id || null,

        workLocationName: employee.workLocation?.name || "",

        companyScope: Boolean(employee.userId.companyScope),

        phone: employee.phone || "",

        personalEmail: employee.personalEmail || employee.userId.personalEmail || "",

        address: employee.address || "",

        city: employee.city || "",

        region: employee.region || "",

        nationalId: employee.nationalId || "",

        tin: employee.tin || "",

        nssfNumber: employee.nssfNumber || "",

        nhifNumber: employee.nhifNumber || "",

        bankName: employee.bankName || "",

        bankBranch: employee.bankBranch || "",

        bankAccountName: employee.bankAccountName || "",

        bankAccountNumber: employee.bankAccountNumber || "",

        drivingLicenceNumber: employee.drivingLicenceNumber || "",

        passportNumber: employee.passportNumber || "",

        workPermitExpiry: employee.workPermitExpiry || null,

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