// Single source of truth for Nilric General Traders' access model.
//
// The company runs on three roles:
//   Managing Director — owns the company and signs off on everything.
//   HR                — runs people operations across every department.
//   Worker            — everyone else: clocks in, applies for leave, sees their
//                       own profile, salary and the organisation chart.
//
// The previous seven-role chart (GM, Operations Manager, QSHE Officer,
// Department Manager, Team Lead) has been retired. Its role keys are still
// accepted so existing accounts keep resolving, and are mapped to their closest
// equivalent below.

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
};

// Both office roles see the whole company. The Managing Director outranks HR so
// only the MD can appoint or edit an HR account.
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
];

export const ROLES = {
  managing_director: {
    key: "managing_director",
    label: "Managing Director",
    level: 100,
    tier: "Executive",
    scope: "company",
    description:
      "Owns the company: every department, salary record, policy and report. The only role that can appoint HR.",
    capabilities: COMPANY_SCOPE,
  },

  hr: {
    key: "hr",
    label: "HR",
    level: 90,
    tier: "Management",
    scope: "company",
    description:
      "Runs people operations: hiring, employee profiles, payroll, leave approvals and attendance across every department.",
    capabilities: COMPANY_SCOPE,
  },

  worker: {
    key: "worker",
    label: "Worker",
    level: 10,
    tier: "Staff",
    scope: "self",
    description:
      "Team member: clocks in and out, applies for leave and sees their own profile, salary and the organisation chart.",
    capabilities: [
      CAPABILITIES.LEAVES_APPLY,
      CAPABILITIES.ATTENDANCE_SELF,
      CAPABILITIES.ORG_VIEW,
    ],
  },
};

// Accounts created before the three-role model still carry the old keys. Map
// them instead of locking those users out. Retired management roles become HR
// because they carried people-management duties; the team-level roles become
// workers.
export const LEGACY_ROLE_ALIASES = {
  admin: "managing_director",
  manager: "hr",
  hr_manager: "hr",
  general_manager: "hr",
  operations_manager: "hr",
  department_manager: "hr",
  qshe_officer: "worker",
  team_lead: "worker",
  tl: "worker",
  employee: "worker",
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

// HR and above run the management console; workers get the self-service portal.
export const isManagementRole = (role) =>
  roleLevel(role) >= ROLES.hr.level;

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

// Kept for callers that still ask; no current role is department-scoped.
export const isDepartmentScoped = (role) =>
  ["department", "team"].includes(getRole(role)?.scope);

export const roleLabel = (role) => getRole(role)?.label || role || "";

// Stored role values that mean the same thing. Filtering the directory by "HR"
// must also match accounts still saved as department_manager or manager.
export const roleFilterAliases = (role) => {
  const resolved = resolveRole(role);

  if (!resolved) {
    return [];
  }

  const aliases = Object.entries(LEGACY_ROLE_ALIASES)
    .filter(([, target]) => target === resolved)
    .map(([legacyKey]) => legacyKey);

  return [...new Set([role, resolved, ...aliases])];
};

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
