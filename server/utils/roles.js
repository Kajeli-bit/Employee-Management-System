// Single source of truth for Nilric General Traders' role structure.
// Levels mirror the reporting lines in the organisation chart: the Managing
// Director sits at the top, the General Manager and Operations Manager below,
// department managers report to Operations, team leads report to a department
// manager, and everyone else is staff.

export const CAPABILITIES = {
  PEOPLE_MANAGE: "people.manage",
  PEOPLE_VIEW: "people.view",
  DEPARTMENTS_MANAGE: "departments.manage",
  DEPARTMENTS_VIEW: "departments.view",
  SALARIES_MANAGE: "salaries.manage",
  SALARIES_VIEW: "salaries.view",
  LEAVES_APPLY: "leaves.apply",
  LEAVES_APPROVE: "leaves.approve",
  LEAVES_VIEW: "leaves.view",
  ATTENDANCE_SELF: "attendance.self",
  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_MANAGE: "attendance.manage",
  LOCATIONS_MANAGE: "locations.manage",
  SETTINGS_MANAGE: "settings.manage",
  ORG_VIEW: "org.view",
  REPORTS_VIEW: "reports.view",
  COMPLIANCE_MANAGE: "compliance.manage",
};

const COMPANY_SCOPE = [
  CAPABILITIES.PEOPLE_MANAGE,
  CAPABILITIES.PEOPLE_VIEW,
  CAPABILITIES.DEPARTMENTS_MANAGE,
  CAPABILITIES.DEPARTMENTS_VIEW,
  CAPABILITIES.SALARIES_MANAGE,
  CAPABILITIES.SALARIES_VIEW,
  CAPABILITIES.LEAVES_APPLY,
  CAPABILITIES.LEAVES_APPROVE,
  CAPABILITIES.LEAVES_VIEW,
  CAPABILITIES.ATTENDANCE_SELF,
  CAPABILITIES.ATTENDANCE_VIEW,
  CAPABILITIES.ATTENDANCE_MANAGE,
  CAPABILITIES.LOCATIONS_MANAGE,
  CAPABILITIES.SETTINGS_MANAGE,
  CAPABILITIES.ORG_VIEW,
  CAPABILITIES.REPORTS_VIEW,
  CAPABILITIES.COMPLIANCE_MANAGE,
];

const DEPARTMENT_SCOPE = [
  CAPABILITIES.PEOPLE_MANAGE,
  CAPABILITIES.PEOPLE_VIEW,
  CAPABILITIES.DEPARTMENTS_VIEW,
  CAPABILITIES.SALARIES_MANAGE,
  CAPABILITIES.SALARIES_VIEW,
  CAPABILITIES.LEAVES_APPLY,
  CAPABILITIES.LEAVES_APPROVE,
  CAPABILITIES.LEAVES_VIEW,
  CAPABILITIES.ATTENDANCE_SELF,
  CAPABILITIES.ATTENDANCE_VIEW,
  CAPABILITIES.ATTENDANCE_MANAGE,
  CAPABILITIES.ORG_VIEW,
  CAPABILITIES.REPORTS_VIEW,
];

const TEAM_SCOPE = [
  CAPABILITIES.PEOPLE_VIEW,
  CAPABILITIES.DEPARTMENTS_VIEW,
  CAPABILITIES.LEAVES_APPLY,
  CAPABILITIES.LEAVES_APPROVE,
  CAPABILITIES.LEAVES_VIEW,
  CAPABILITIES.ATTENDANCE_SELF,
  CAPABILITIES.ATTENDANCE_VIEW,
  CAPABILITIES.ORG_VIEW,
];

export const ROLES = {
  managing_director: {
    key: "managing_director",
    label: "Managing Director",
    level: 100,
    tier: "Executive",
    scope: "company",
    description:
      "Owns the company: every department, salary record, policy and report.",
    capabilities: COMPANY_SCOPE.filter(
      (capability) => capability !== CAPABILITIES.LEAVES_APPLY
    ),
  },

  general_manager: {
    key: "general_manager",
    label: "General Manager",
    level: 95,
    tier: "Executive",
    scope: "company",
    description:
      "Runs day-to-day company operations across all departments and reports to the Managing Director.",
    capabilities: COMPANY_SCOPE,
  },

  operations_manager: {
    key: "operations_manager",
    label: "Operations Manager",
    level: 90,
    tier: "Management",
    scope: "company",
    description:
      "Coordinates department managers and oversees delivery across engineering, ICT, medical, finance and business development.",
    capabilities: COMPANY_SCOPE,
  },

  qshe_officer: {
    key: "qshe_officer",
    label: "QSHE Officer",
    level: 85,
    tier: "Management",
    scope: "company",
    description:
      "Independent quality, safety, health and environment oversight reporting to the General Manager.",
    capabilities: [
      CAPABILITIES.PEOPLE_VIEW,
      CAPABILITIES.DEPARTMENTS_VIEW,
      CAPABILITIES.LEAVES_VIEW,
      CAPABILITIES.ATTENDANCE_SELF,
      CAPABILITIES.ATTENDANCE_VIEW,
      CAPABILITIES.ORG_VIEW,
      CAPABILITIES.REPORTS_VIEW,
      CAPABILITIES.COMPLIANCE_MANAGE,
    ],
  },

  department_manager: {
    key: "department_manager",
    label: "Department Manager",
    level: 80,
    tier: "Management",
    scope: "department",
    description:
      "Leads one department or project unit, its team leads and its employees, and reports to the Operations Manager.",
    capabilities: DEPARTMENT_SCOPE,
  },

  team_lead: {
    key: "team_lead",
    label: "Team Lead",
    level: 60,
    tier: "Leadership",
    scope: "department",
    description:
      "Supervises a team inside a department, approves their leave and reviews their attendance.",
    capabilities: TEAM_SCOPE,
  },

  employee: {
    key: "employee",
    label: "Employee",
    level: 10,
    tier: "Staff",
    scope: "self",
    description:
      "Team member: clocks in and out, applies for leave and views their own profile and salary.",
    capabilities: [
      CAPABILITIES.LEAVES_APPLY,
      CAPABILITIES.ATTENDANCE_SELF,
      CAPABILITIES.ORG_VIEW,
    ],
  },
};

// Accounts created before the organisation structure was adopted still carry
// the generic role keys. Treat them as their closest new equivalent instead of
// locking those users out.
export const LEGACY_ROLE_ALIASES = {
  admin: "managing_director",
  manager: "department_manager",
  hr: "department_manager",
  tl: "team_lead",
};

export const ROLE_KEYS = Object.keys(ROLES);

export const LEGACY_ROLE_KEYS = Object.keys(LEGACY_ROLE_ALIASES);

export const ROLE_OPTIONS = ROLE_KEYS.map((key, index) => ({
  value: key,
  label: ROLES[key].label,
  level: ROLES[key].level,
  tier: ROLES[key].tier,
  order: index,
}));

export const roleHierarchy = ROLE_KEYS.reduce((levels, key) => {
  levels[key] = ROLES[key].level;
  return levels;
}, {});

export const resolveRole = (role) => {
  if (!role || typeof role !== "string") {
    return null;
  }

  if (ROLES[role]) {
    return role;
  }

  return LEGACY_ROLE_ALIASES[role] || null;
};

export const getRole = (role) => {
  const key = resolveRole(role);

  return key ? ROLES[key] : null;
};

export const roleLevel = (role) => getRole(role)?.level ?? 0;

export const isValidRole = (role) => resolveRole(role) !== null;

export const hasCapability = (role, capability) =>
  Boolean(getRole(role)?.capabilities.includes(capability));

export const isManagementRole = (role) => roleLevel(role) >= ROLES.team_lead.level;

export const isExecutiveRole = (role) => getRole(role)?.tier === "Executive";

export const canManageRole = (actorRole, targetRole) => {
  const actor = getRole(actorRole);
  const target = getRole(targetRole);

  if (!actor || !target) {
    return false;
  }

  return actor.level > target.level;
};

export const canAccessRole = (actorRole, targetRole) => {
  const actor = getRole(actorRole);
  const target = getRole(targetRole);

  if (!actor || !target) {
    return false;
  }

  return actor.level >= target.level;
};

// Roles the actor is allowed to assign when creating or editing an employee.
export const assignableRoles = (actorRole) => {
  const actor = getRole(actorRole);

  if (!actor) {
    return [];
  }

  return ROLE_OPTIONS.filter((role) => actor.level > role.level).map(
    (role) => role.value
  );
};

// Department and team leads only act inside their own department. Company-level
// roles (MD, GM, Operations, QSHE) see every department.
export const isDepartmentScoped = (role) =>
  ["department", "team"].includes(getRole(role)?.scope);

export const roleLabel = (role) => getRole(role)?.label || role || "";

// Client-safe copy of the catalogue (used by /api/org/structure).
export const publicRoleCatalog = () =>
  ROLE_KEYS.map((key) => ({
    key,
    label: ROLES[key].label,
    level: ROLES[key].level,
    tier: ROLES[key].tier,
    scope: ROLES[key].scope,
    description: ROLES[key].description,
    capabilities: ROLES[key].capabilities,
  }));
