// Mirrors server/utils/roles.js. Keep both files in step when roles or
// capabilities change: the API enforces the rules, this copy only shapes the UI.

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
  CAPABILITIES.COMPLIANCE_MANAGE,
];

const DEPARTMENT = [
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

const TEAM = [
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
    label: "Managing Director",
    level: 100,
    tier: "Executive",
    scope: "company",
    responsibilities: "Company direction, board reporting, final approvals.",
    capabilities: COMPANY.filter(
      (capability) => capability !== CAPABILITIES.LEAVES_APPLY
    ),
  },
  general_manager: {
    label: "General Manager",
    level: 95,
    tier: "Executive",
    scope: "company",
    responsibilities: "Runs all departments and reports to the Managing Director.",
    capabilities: COMPANY,
  },
  operations_manager: {
    label: "Operations Manager",
    level: 90,
    tier: "Management",
    scope: "company",
    responsibilities: "Coordinates department managers and project delivery.",
    capabilities: COMPANY,
  },
  qshe_officer: {
    label: "QSHE Officer",
    level: 85,
    tier: "Management",
    scope: "company",
    responsibilities: "Quality, safety, health and environment oversight.",
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
    label: "Department Manager",
    level: 80,
    tier: "Management",
    scope: "department",
    responsibilities:
      "Leads one department or project unit and its team leads.",
    capabilities: DEPARTMENT,
  },
  team_lead: {
    label: "Team Lead",
    level: 60,
    tier: "Leadership",
    scope: "department",
    responsibilities: "Supervises a team, approves leave, reviews attendance.",
    capabilities: TEAM,
  },
  employee: {
    label: "Employee",
    level: 10,
    tier: "Staff",
    scope: "self",
    responsibilities: "Clocks in and out, applies for leave, views own records.",
    capabilities: [
      CAPABILITIES.LEAVES_APPLY,
      CAPABILITIES.ATTENDANCE_SELF,
      CAPABILITIES.ORG_VIEW,
    ],
  },
};

const LEGACY_ROLE_ALIASES = {
  admin: "managing_director",
  manager: "department_manager",
  hr: "department_manager",
  tl: "team_lead",
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

export const roleLabel = (role) => getRole(role)?.label || role || "Employee";

export const roleLevel = (role) => getRole(role)?.level || 0;

export const isManagementRole = (role) =>
  roleLevel(role) >= ROLES.team_lead.level;

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

export const roleBadgeClass = (role) => {
  switch (getRole(role)?.tier) {
    case "Executive":
      return "bg-slate-900 text-white";
    case "Management":
      return "bg-brand-50 text-brand-800";
    case "Leadership":
      return "bg-amber-50 text-amber-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

// The Nilric chart, from ORGANIZATION STRUCTURE - NILRIC.pdf. Used by the
// organisation page; live headcounts are merged in from the API.
export const NILRIC_ORG = {
  leadership: [
    {
      role: "managing_director",
      reportsTo: null,
      scope: "Whole company",
      teams: [],
    },
    {
      role: "general_manager",
      reportsTo: "Managing Director",
      scope: "Whole company",
      teams: [],
    },
    {
      role: "operations_manager",
      reportsTo: "General Manager",
      scope: "All departments",
      teams: [],
    },
  ],
  oversight: [
    {
      role: "qshe_officer",
      reportsTo: "General Manager",
      scope: "Quality, safety, health & environment",
      teams: [],
    },
  ],
  functions: [
    {
      key: "administration_hr",
      label: "Administration / Human Resource",
      role: "department_manager",
      teams: [],
    },
    {
      key: "business_development",
      label: "Business Development",
      role: "department_manager",
      teams: ["Tender Team", "Sales & Marketing Team"],
    },
    {
      key: "technical_ict",
      label: "Technical ICT",
      role: "department_manager",
      teams: ["Technical ICT Team"],
    },
    {
      key: "finance",
      label: "Finance",
      role: "department_manager",
      teams: ["Finance Team"],
    },
    {
      key: "medical_projects",
      label: "Medical Projects",
      role: "department_manager",
      teams: ["Medical Team"],
    },
  ],
  engineering: [
    {
      key: "engineering",
      label: "Engineering",
      role: "department_manager",
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
