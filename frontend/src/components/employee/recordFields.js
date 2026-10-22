import { formatCurrency, formatDate } from "../../utils/format";
import { roleLabel } from "../../utils/roles";

const dateOrEmpty = (value) => (value ? formatDate(value) : "");

const joinOrEmpty = (values) =>
  Array.isArray(values) && values.length > 0 ? values.join(", ") : "";

// The personnel file. One definition feeds the details page, the directory
// popup and the completeness meter, so the three can never disagree about which
// details belong on a record.
export const buildRecordGroups = (employee, person) => {
  const supervisor = person?.reportsTo;

  const reportsTo =
    supervisor && typeof supervisor !== "string"
      ? supervisor.designation
        ? `${supervisor.name} — ${supervisor.designation}`
        : supervisor.name
      : "";

  const address = [employee.address, employee.city, employee.region]
    .filter(Boolean)
    .join(", ");

  return [
    {
      title: "Position and employment",
      fields: [
        { label: "Role", value: roleLabel(person?.role) },
        {
          label: "Department",
          value: employee.department?.dep_name || "",
        },
        { label: "Designation", value: employee.designation },
        { label: "Reports to", value: reportsTo },
        { label: "Employment type", value: employee.employmentType },
        { label: "Employment status", value: employee.employmentStatus },
        {
          label: "Date joined",
          value: dateOrEmpty(employee.dateOfJoining),
          mono: true,
        },
        {
          label: "Contract ends",
          value: dateOrEmpty(employee.contractEndDate),
          mono: true,
        },
        { label: "Attendance mode", value: employee.workMode },
      ],
    },
    {
      title: "Personal and contact",
      fields: [
        { label: "Work email", value: person?.email },
        { label: "Personal email", value: employee.personalEmail },
        { label: "Phone", value: employee.phone, mono: true },
        {
          label: "Date of birth",
          value: dateOrEmpty(employee.dob),
          mono: true,
        },
        { label: "Gender", value: employee.gender },
        { label: "Marital status", value: employee.maritalStatus },
        { label: "Address", value: address, wide: true },
      ],
    },
    {
      title: "Emergency contact",
      fields: [
        { label: "Name", value: employee.emergencyContact?.name },
        {
          label: "Relationship",
          value: employee.emergencyContact?.relationship,
        },
        {
          label: "Phone",
          value: employee.emergencyContact?.phone,
          mono: true,
        },
      ],
    },
    {
      title: "Statutory and payroll",
      fields: [
        { label: "National ID (NIN)", value: employee.nationalId, mono: true },
        { label: "TIN", value: employee.tin, mono: true },
        { label: "NSSF number", value: employee.nssfNumber, mono: true },
        { label: "Bank", value: employee.bankName },
        { label: "Account name", value: employee.bankAccountName },
        {
          label: "Account number",
          value: employee.bankAccountNumber,
          mono: true,
        },
        {
          label: "Monthly salary",
          value:
            employee.salary === undefined || employee.salary === null
              ? ""
              : formatCurrency(employee.salary),
          mono: true,
        },
      ],
    },
    {
      title: "Qualifications",
      fields: [
        { label: "Highest qualification", value: employee.qualification },
        { label: "Field of study", value: employee.fieldOfStudy },
        { label: "Certifications", value: joinOrEmpty(employee.certifications) },
        { label: "Skills", value: joinOrEmpty(employee.skills), wide: true },
        { label: "Notes", value: employee.notes, wide: true },
      ],
    },
  ];
};

export const missingFields = (groups) =>
  groups.flatMap((group) =>
    group.fields
      .filter((field) => !field.value)
      .map((field) => ({ group: group.title, label: field.label }))
  );

export const completenessOf = (groups) => {
  const tracked = groups.reduce(
    (total, group) => total + group.fields.length,
    0
  );
  const recorded = groups.reduce(
    (total, group) =>
      total + group.fields.filter((field) => Boolean(field.value)).length,
    0
  );

  return {
    tracked,
    recorded,
    percent: tracked === 0 ? 0 : Math.round((recorded / tracked) * 100),
  };
};
