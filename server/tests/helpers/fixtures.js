import mongoose from "mongoose";

import Company from "../../models/Company.js";
import Department from "../../models/Department.js";
import Employee from "../../models/Employee.js";
import User from "../../models/User.js";
import WorkLocation from "../../models/WorkLocation.js";

const { ObjectId } = mongoose.Types;

// Nilric head office, matching the seeded coordinates.
export const HEAD_OFFICE = {
  latitude: -6.8167,
  longitude: 39.2889,
};

// Roughly 12 km north of the office: comfortably outside every fence.
export const FAR_AWAY = {
  latitude: -6.7,
  longitude: 39.2889,
};

export const makeUser = async ({
  companyId,
  role = "employee",
  name = "Test User",
  email,
  reportsTo = null,
}) => {
  const username = `user-${new ObjectId().toString().slice(-8)}`;

  return User.create({
    companyId,
    name,
    role,
    designation: "Staff",
    dob: new Date("1994-04-12T00:00:00.000Z"),
    username,
    email: email || `${username}@nilric.co.tz`,
    reportsTo,
  });
};

export const makeEmployee = async ({
  companyId,
  user,
  department,
  createdBy,
  employeeId,
  workMode = "Office",
  employmentStatus = "Active",
}) =>
  Employee.create({
    companyId,
    userId: user._id,
    department,
    createdBy,
    employeeId,
    salary: 1_500_000,
    designation: user.designation,
    workMode,
    employmentStatus,
  });

export const seedOrganisation = async ({
  policy = {},
  name = "Nilric General Traders",
} = {}) => {
  const companyId = new ObjectId();

  const head = await makeUser({
    companyId,
    role: "managing_director",
    name: "Managing Director",
  });

  const company = await Company.create({
    _id: companyId,
    name,
    head: head._id,
    attendance: {
      timezone: "Africa/Dar_es_Salaam",
      workStart: "08:00",
      workEnd: "17:00",
      saturdayWorkStart: "09:00",
      saturdayWorkEnd: "13:00",
      graceMinutes: 15,
      halfDayMinutes: 240,
      requireGeofence: true,
      ...policy,
    },
  });

  const finance = await Department.create({
    companyId,
    dep_name: "Finance",
    kind: "department",
    key: "finance",
  });

  const financeTeam = await Department.create({
    companyId,
    dep_name: "Finance Team",
    kind: "team",
    key: "finance_team",
    parent: finance._id,
  });

  const operations = await Department.create({
    companyId,
    dep_name: "Operations",
    kind: "department",
    key: "operations",
  });

  const location = await WorkLocation.create({
    companyId,
    name: "Nilric Head Office",
    address: "Samora Avenue, Dar es Salaam",
    latitude: HEAD_OFFICE.latitude,
    longitude: HEAD_OFFICE.longitude,
    radiusMeters: 250,
    isPrimary: true,
    createdBy: head._id,
  });

  return {
    company,
    head,
    finance,
    financeTeam,
    operations,
    location,
  };
};

// A signed-in office worker with an employee record, returned as the `user`
// document the auth middleware would attach to the request.
export const makeStaff = async ({
  companyId,
  department,
  role = "employee",
  createdBy,
  name,
  employeeId,
  workMode = "Office",
  employmentStatus = "Active",
}) => {
  const user = await makeUser({
    companyId,
    role,
    name: name || `${role} user`,
  });

  const employee = await makeEmployee({
    companyId,
    user,
    department,
    createdBy: createdBy || user._id,
    employeeId: employeeId || `EMP-${new ObjectId().toString().slice(-5)}`,
    workMode,
    employmentStatus,
  });

  return { user, employee };
};
