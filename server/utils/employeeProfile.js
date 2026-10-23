import { isManagementRole } from "./roles.js";

// Everything on the personnel file other than the identity, position and
// pay fields handled explicitly by the employee controller. Kept in one place
// so create and update accept exactly the same set of details.
export const PROFILE_FIELDS = [
  "employmentType",
  "employmentStatus",
  "dateOfJoining",
  "contractEndDate",
  "probationEndDate",
  "workMode",
  "phone",
  "personalEmail",
  "address",
  "city",
  "region",
  "nationalId",
  "tin",
  "nssfNumber",
  "nhifNumber",
  "bankName",
  "bankBranch",
  "bankAccountName",
  "bankAccountNumber",
  "drivingLicenceNumber",
  "passportNumber",
  "workPermitExpiry",
  "qualification",
  "fieldOfStudy",
  "notes",
];

export const splitList = (value) => {
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

export const asBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
};

export const readProfileFields = (body) => {
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

// Onboarding only insists on a name, a work email and a phone number. The
// username and staff ID are derived from those, and payroll/department details
// can be filled in later.
export const usernameFromEmail = (email) => {
  const local = String(email || "")
    .trim()
    .toLowerCase()
    .split("@")[0];

  const slug = local
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 30);

  return slug || "worker";
};

export const employeeIdSeed = (now = new Date()) => {
  const year = String(now.getFullYear()).slice(-2);
  const digits = String(Math.floor(1000 + Math.random() * 9000));

  return `NIL-${year}-${digits}`;
};

export const phoneIsUsable = (phone) =>
  String(phone ?? "").replace(/\D/g, "").length >= 7;

export const missingEmployeeEssentials = ({ name, email, phone }) => {
  const missing = [];

  if (!String(name ?? "").trim()) {
    missing.push("name");
  }

  if (!String(email ?? "").trim()) {
    missing.push("email");
  }

  if (!phoneIsUsable(phone)) {
    missing.push("phone");
  }

  return missing;
};

// Pay is optional at onboarding; only reject values that are not an amount.
export const parseOptionalSalary = (value) => {
  if (value === undefined || value === null || value === "") {
    return { value: undefined };
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Monthly salary must be a positive number" };
  }

  return { value: amount };
};

// Company-wide visibility predates the three-role model, where it let a
// department manager see every department. It is no longer surfaced in the UI,
// but the API keeps accepting it so old records survive; only the office roles
// (Managing Director and HR) may set it.
export const canGrantCompanyScope = (actor) =>
  Boolean(actor) && isManagementRole(actor.role);
