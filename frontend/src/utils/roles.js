// Mirrors server/utils/roles.js. Keep both files in step when roles or
// capabilities change: the API enforces the rules, this copy only shapes the UI.
//
// Three roles only — Managing Director, HR and Worker. The retired chart roles
// (GM, Operations, QSHE, Department Manager, Team Lead) still resolve through
// the legacy map so existing accounts land on the right workspace.

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

const COMPANY = [
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
    label: "Managing Director",
    level: 100,
    tier: "Executive",
    scope: "company",
    responsibilities:
      "Company direction, board reporting, final approvals and appointing HR.",
    description:
      "Owns the company: every department, salary record, policy and report. The only role that can appoint HR.",
    capabilities: COMPANY,
  },
  hr: {
    label: "HR",
    level: 90,
    tier: "Management",
    scope: "company",
    responsibilities:
      "Hiring, employee records, payroll, leave approvals, attendance and policy.",
    description:
      "Runs people operations: hiring, employee profiles, payroll, leave approvals and attendance across every department.",
    capabilities: COMPANY,
  },
  worker: {
    label: "Worker",
    level: 10,
    tier: "Staff",
    scope: "self",
    responsibilities:
      "Clocks in and out, applies for leave, views own records and the org chart.",
    description:
      "Team member: clocks in and out, applies for leave and sees their own profile, salary and the organisation chart.",
    capabilities: [
      CAPABILITIES.LEAVES_APPLY,
      CAPABILITIES.ATTENDANCE_SELF,
      CAPABILITIES.ORG_VIEW,
    ],
  },
};

const LEGACY_ROLE_ALIASES = {
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

export const ROLE_OPTIONS = Object.entries(ROLES).map(([value, role]) => ({
  value,
  ...role,
}));

export const resolveRole = (role) => {
  if (!role) {
    return null;
  }

  if (ROLES[role]) {
    return role;
  }

  return LEGACY_ROLE_ALIASES[role] || null;
};

export const getRole = (role) => {
  const key = resolveRole(role);

  return key ? { key, ...ROLES[key] } : null;
};

export const roleLabel = (role) => getRole(role)?.label || role || "Worker";

export const roleLevel = (role) => getRole(role)?.level || 0;

// HR and above run the management console; workers get the self-service portal.
export const isManagementRole = (role) => roleLevel(role) >= ROLES.hr.level;

export const canManageRole = (actorRole, targetRole) => {
  const actor = getRole(actorRole);
  const target = getRole(targetRole);

  return Boolean(actor && target && actor.level > target.level);
};

export const hasCapability = (role, capability) =>
  Boolean(getRole(role)?.capabilities.includes(capability));

export const assignableRoles = (actorRole) => {
  const actor = getRole(actorRole);

  if (!actor) {
    return [];
  }

  return ROLE_OPTIONS.filter((role) => actor.level > role.level);
};

// Plain-language names for the capability keys in the server catalogue. Used
// when explaining what a role will be able to do before it is granted.
export const CAPABILITY_LABELS = {
  [CAPABILITIES.PEOPLE_MANAGE]: "Add and edit employees",
  [CAPABILITIES.PEOPLE_VIEW]: "View employee records",
  [CAPABILITIES.DEPARTMENTS_MANAGE]: "Manage departments",
  [CAPABILITIES.DEPARTMENTS_VIEW]: "View departments",
  [CAPABILITIES.SALARIES_MANAGE]: "Run payroll",
  [CAPABILITIES.SALARIES_VIEW]: "View salaries",
  [CAPABILITIES.LEAVES_APPLY]: "Apply for leave",
  [CAPABILITIES.LEAVES_APPROVE]: "Approve leave",
  [CAPABILITIES.LEAVES_VIEW]: "View leave records",
  [CAPABILITIES.ATTENDANCE_SELF]: "Clock in and out",
  [CAPABILITIES.ATTENDANCE_VIEW]: "View attendance",
  [CAPABILITIES.ATTENDANCE_MANAGE]: "Review and correct attendance",
  [CAPABILITIES.LOCATIONS_MANAGE]: "Manage work locations",
  [CAPABILITIES.SETTINGS_MANAGE]: "Change company settings",
  [CAPABILITIES.ORG_VIEW]: "View the organisation chart",
  [CAPABILITIES.REPORTS_VIEW]: "View reports",
};

export const capabilityLabels = (capabilities = []) =>
  capabilities.map((capability) => CAPABILITY_LABELS[capability] || capability);

export const ROLE_TIER_ORDER = ["Executive", "Management", "Staff"];

// How far a role's reach extends, in words a hiring manager understands.
export const scopeLabel = (scope) => {
  switch (scope) {
    case "company":
      return "Whole company";
    case "department":
      return "Own department";
    case "team":
      return "Own team";
    case "self":
      return "Own records only";
    default:
      return "Not set";
  }
};

export const isDepartmentScoped = (role) =>
  ["department", "team"].includes(getRole(role)?.scope);

// Roles grouped for a picker, senior first, with empty tiers dropped.
export const groupRolesByTier = (roles = []) =>
  ROLE_TIER_ORDER.map((tier) => ({
    tier,
    roles: roles.filter((role) => role.tier === tier),
  })).filter((group) => group.roles.length > 0);

export const roleBadgeClass = (role) => {
  switch (getRole(role)?.tier) {
    case "Executive":
      return "bg-slate-900 text-white";
    case "Management":
      return "bg-brand-50 text-brand-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

// The Nilric chart used by the organisation page. Live headcounts are merged in
// from the API; the access model above is deliberately simpler than the
// company's reporting lines, which are captured by each employee's supervisor.
export const NILRIC_ORG = {
  leadership: [
    {
      role: "managing_director",
      reportsTo: null,
      scope: "Whole company · board and final approvals",
    },
    {
      role: "hr",
      reportsTo: "Managing Director",
      scope: "Whole company · people, payroll, leave and policy",
    },
  ],
  functions: [
    {
      key: "administration_hr",
      label: "Administration / Human Resource",
      teams: [],
    },
    {
      key: "business_development",
      label: "Business Development",
      teams: ["Tender Team", "Sales & Marketing Team"],
    },
    {
      key: "technical_ict",
      label: "Technical ICT",
      teams: ["Technical ICT Team"],
    },
    {
      key: "finance",
      label: "Finance",
      teams: ["Finance Team"],
    },
    {
      key: "medical_projects",
      label: "Medical Projects",
      teams: ["Medical Team"],
    },
  ],
  engineering: [
    {
      key: "engineering",
      label: "Engineering",
      teams: [
        "Civil Engineering Team",
        "Electrical & Telecommunication Team",
        "Mechanical Engineering Team",
      ],
    },
  ],
};

export const WORK_MODES = ["Office", "Field", "Remote"];

export const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Intern",
  "Casual",
];

export const EMPLOYMENT_STATUSES = [
  "Active",
  "Probation",
  "On Leave",
  "Suspended",
  "Exited",
];
