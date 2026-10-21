import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import WorkLocation from "../models/WorkLocation.js";

// The Nilric organisation chart, transcribed from the company organisation
// structure document. Seeded for each new company so adding an employee is
// possible immediately after registration.
export const NILRIC_DEPARTMENTS = [
  {
    key: "administration_hr",
    name: "Administration & Human Resource",
    description:
      "Handles people, payroll administration, office services and company records.",
    jobTitles: [
      "Human Resource Manager",
      "Human Resource Officer",
      "Administrative Officer",
      "Payroll Officer",
      "Receptionist",
      "Office Assistant",
    ],
  },
  {
    key: "business_development",
    name: "Business Development",
    description:
      "Wins and grows business through tenders, sales and marketing.",
    jobTitles: [
      "Business Development Manager",
      "Tender Officer",
      "Bid Coordinator",
      "Sales Executive",
      "Marketing Officer",
    ],
    teams: [
      { key: "tender_team", name: "Tender Team" },
      { key: "sales_marketing_team", name: "Sales & Marketing Team" },
    ],
  },
  {
    key: "technical_ict",
    name: "Technical ICT",
    description:
      "Delivers ICT infrastructure, networking, cloud and managed support projects.",
    jobTitles: [
      "Technical Manager ICT",
      "Network Engineer",
      "Systems Administrator",
      "Cloud Engineer",
      "Helpdesk Technician",
    ],
    teams: [{ key: "technical_ict_team", name: "Technical ICT Team" }],
  },
  {
    key: "finance",
    name: "Finance",
    description:
      "Owns budgeting, payroll, tax compliance and financial reporting.",
    jobTitles: [
      "Finance Manager",
      "Accountant",
      "Accounts Assistant",
      "Payroll Officer",
      "Internal Auditor",
    ],
    teams: [{ key: "finance_team", name: "Finance Team" }],
  },
  {
    key: "medical_projects",
    name: "Medical Projects",
    description:
      "Supplies, installs and maintains medical and laboratory equipment.",
    jobTitles: [
      "Medical Project Manager",
      "Biomedical Engineer",
      "Medical Equipment Technician",
      "Clinical Application Specialist",
    ],
    teams: [{ key: "medical_team", name: "Medical Team" }],
  },
  {
    key: "engineering",
    name: "Engineering",
    description:
      "Delivers building, civil, electrical, telecommunication and mechanical engineering projects.",
    jobTitles: [
      "Engineering Manager",
      "Civil Engineer",
      "Site Engineer",
      "Quantity Surveyor",
      "Site Supervisor",
      "Electrical Engineer",
      "Telecommunication Engineer",
      "Electrician",
      "Fibre Technician",
      "Mechanical Engineer",
      "HVAC Technician",
      "Plumbing Supervisor",
      "Welder / Fabricator",
    ],
    teams: [
      { key: "civil_team", name: "Civil Engineering Team" },
      { key: "electrical_telecom_team", name: "Electrical & Telecommunication Team" },
      { key: "mechanical_team", name: "Mechanical Engineering Team" },
    ],
  },
];

// Approximate coordinates for the Samora Avenue head office. Every work
// location is editable from the Work Locations screen, so a more precise pin can
// be dropped later.
export const HEAD_OFFICE = {
  name: "Nilric Head Office",
  address:
    "Plot 163/129, Apartment 107, Samora Avenue, P.O. Box 40661, Dar es Salaam",
  latitude: -6.8167,
  longitude: 39.2889,
  radiusMeters: 250,
  isPrimary: true,
};

// Bring an already-seeded company in line with NILRIC_DEPARTMENTS without
// wiping anything. Departments and teams are matched by their stable `key`
// and renamed or reparented in place. Seeded units that no longer exist in
// the defaults are removed only when nobody belongs to them; units that still
// hold employees, and custom keyless departments created in the UI, are left
// alone and reported so people can be reassigned first.
export const syncCompanyStructure = async ({ companyId, session }) => {
  const options = session ? { session } : {};
  const departments = {};
  const summary = {
    created: [],
    renamed: [],
    reparented: [],
    removed: [],
    kept: [],
  };

  for (const definition of NILRIC_DEPARTMENTS) {
    const existing = await Department.findOne({
      companyId,
      key: definition.key,
    }).session(session || null);

    if (!existing) {
      summary.created.push(definition.name);
    } else if (existing.dep_name !== definition.name) {
      summary.renamed.push(`${existing.dep_name} -> ${definition.name}`);
    }

    const saved = await Department.findOneAndUpdate(
      { companyId, key: definition.key },
      {
        $set: {
          dep_name: definition.name,
          description: definition.description,
          kind: "department",
          parent: null,
          companyId,
        },
        $setOnInsert: { key: definition.key },
      },
      { upsert: true, returnDocument: "after", ...options }
    );

    departments[definition.key] = saved;

    for (const team of definition.teams || []) {
      const existingTeam = await Department.findOne({
        companyId,
        key: team.key,
      }).session(session || null);

      if (!existingTeam) {
        summary.created.push(team.name);
      } else if (existingTeam.parent?.toString() !== saved._id.toString()) {
        summary.reparented.push(`${team.name} -> ${definition.name}`);
      }

      await Department.findOneAndUpdate(
        { companyId, key: team.key },
        {
          $set: {
            dep_name: team.name,
            description: `${team.name} within ${definition.name}.`,
            kind: "team",
            parent: saved._id,
            companyId,
          },
          $setOnInsert: { key: team.key },
        },
        { upsert: true, returnDocument: "after", ...options }
      );
    }
  }

  const expectedKeys = new Set();

  for (const definition of NILRIC_DEPARTMENTS) {
    expectedKeys.add(definition.key);

    for (const team of definition.teams || []) {
      expectedKeys.add(team.key);
    }
  }

  const deletedIds = new Set();
  const stale = await Department.find({
    companyId,
    key: { $nin: [...expectedKeys] },
  }).session(session || null);
  const staleById = new Map(stale.map((unit) => [unit._id.toString(), unit]));

  for (const unit of stale) {
    if (!unit.key || deletedIds.has(unit._id.toString())) {
      continue;
    }

    const children = await Department.find({
      companyId,
      parent: unit._id,
    }).session(session || null);
    const removableChildren = children.filter((child) =>
      staleById.has(child._id.toString())
    );

    if (removableChildren.length !== children.length) {
      summary.kept.push(`${unit.dep_name} (has custom sub-units)`);
      continue;
    }

    const unitIds = [
      unit._id,
      ...removableChildren.map((child) => child._id),
    ];
    const memberCount = await Employee.countDocuments({
      companyId,
      department: { $in: unitIds },
    }).session(session || null);

    if (memberCount > 0) {
      summary.kept.push(
        `${unit.dep_name} (${memberCount} member${memberCount === 1 ? "" : "s"})`
      );
      continue;
    }

    await Department.deleteMany({
      companyId,
      _id: { $in: unitIds },
    }).session(session || null);

    for (const id of unitIds) {
      deletedIds.add(id.toString());
    }

    summary.removed.push(unit.dep_name);
  }

  return { departments, summary };
};

export const seedCompanyDefaults = async ({ companyId, createdBy, session }) => {
  const options = session ? { session } : {};
  const createdDepartments = {};

  const existingDepartments = await Department.countDocuments({
    companyId,
  }).session(session || null);

  if (existingDepartments === 0) {
    const departments = [];

    for (const department of NILRIC_DEPARTMENTS) {
      const parentId = new Department()._id;

      departments.push({
        _id: parentId,
        dep_name: department.name,
        description: department.description,
        kind: "department",
        key: department.key,
        parent: null,
        companyId,
      });

      for (const team of department.teams || []) {
        departments.push({
          dep_name: team.name,
          description: `${team.name} within ${department.name}.`,
          kind: "team",
          key: team.key,
          parent: parentId,
          companyId,
        });
      }
    }

    const saved = await Department.insertMany(departments, options);

    for (const department of saved) {
      if (department.key) {
        createdDepartments[department.key] = department;
      }
    }
  }

  let primaryLocation = null;

  const existingLocations = await WorkLocation.countDocuments({
    companyId,
  }).session(session || null);

  if (existingLocations === 0) {
    const locations = await WorkLocation.create(
      [
        {
          ...HEAD_OFFICE,
          companyId,
          createdBy,
        },
      ],
      options
    );

    primaryLocation = locations[0];
  } else {
    primaryLocation = await WorkLocation.findOne({
      companyId,
      isPrimary: true,
    }).session(session || null);
  }

  return {
    departments: createdDepartments,
    primaryLocation,
  };
};

export const jobTitlesForDepartments = () =>
  NILRIC_DEPARTMENTS.flatMap((department) =>
    (department.jobTitles || []).map((title) => ({
      title,
      departmentKey: department.key,
      departmentName: department.name,
    }))
  );
