import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import { publicRoleCatalog } from "../../server/utils/roles.js";
import {
  parentDepartmentOf,
  suggestSupervisorFor,
  validateWorker,
} from "../src/utils/employeeForm.js";
import {
  designationForRole,
  roleForDesignation,
} from "../src/utils/roles.js";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const results = [];
const check = (label, condition) => {
  results.push({ label, ok: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
};

try {
  const mod = await server.ssrLoadModule(
    "/src/components/employee/EmployeeForm.jsx"
  );
  const EmployeeForm = mod.default;
  const { RolePicker, RoleAccess } = mod;

  const roleCatalog = publicRoleCatalog();
  const departments = [
    { _id: "d1", dep_name: "Finance", kind: "department", key: "finance" },
    { _id: "t1", dep_name: "Finance Team", kind: "team", parent: "d1" },
    { _id: "d2", dep_name: "Engineering", kind: "department", key: "engineering" },
  ];
  const supervisors = [
    { _id: "s-md", name: "Manager", roleLabel: "Managing Director", level: 100, department: null },
    { _id: "s-hr", name: "Ester", roleLabel: "HR", level: 90, department: "d1" },
    { _id: "s-hr2", name: "Hmtani", roleLabel: "HR", level: 90, department: "d2" },
  ];
  const locations = [
    { _id: "l1", name: "Nilric Head Office", isPrimary: true, address: "Samora Avenue" },
    { _id: "l2", name: "Kariakoo Branch", isPrimary: false },
  ];
  const baseInitial = {
    name: "Amina Juma",
    username: "amina.juma",
    email: "amina@nilric.co.tz",
    employeeId: "NIL-26-1234",
    role: "worker",
    department: "t1",
    designation: "Worker",
    salary: "850000",
    reportsTo: "s-md",
    workLocation: "l1",
    dateOfJoining: "2026-11-01",
    "emergencyContact.name": "Neema Juma",
  };

  const render = (props = {}) =>
    renderToStaticMarkup(
      React.createElement(EmployeeForm, {
        currentUserRole: "managing_director",
        roleCatalog,
        departments,
        supervisors,
        locations,
        initial: baseInitial,
        onSubmit: () => {},
        onCancel: () => {},
        ...props,
      })
    );

  // Role picker
  const roles = roleCatalog.map((role) => ({ value: role.key, ...role }));
  const picker = (actor) =>
    renderToStaticMarkup(
      React.createElement(RolePicker, {
        roles,
        value: "worker",
        actorRole: actor,
        onSelect: () => {},
      })
    );

  const mdPicker = picker("managing_director");
  const hrPicker = picker("hr");
  const labels = roleCatalog.map((role) => role.label);

  check("the catalogue has exactly three roles", labels.length === 3);
  check(
    "every role is listed for the MD",
    labels.every((label) => mdPicker.includes(label))
  );
  check("the picker renders three cards", (mdPicker.match(/aria-pressed/g) || []).length === 3);
  check(
    "the picker lays roles out horizontally from senior to junior",
    mdPicker.includes('class="grid grid-cols-1 gap-2 sm:grid-cols-3"') &&
      mdPicker.indexOf("Managing Director") < mdPicker.indexOf(">HR<") &&
      mdPicker.indexOf(">HR<") < mdPicker.indexOf(">Worker<")
  );
  check(
    "MD can assign HR and Worker but not another MD",
    (mdPicker.match(/disabled="" aria-pressed/g) || []).length === 1
  );
  check(
    "HR can only assign Worker",
    (hrPicker.match(/disabled="" aria-pressed/g) || []).length === 2
  );

  const hrAccess = renderToStaticMarkup(
    React.createElement(RoleAccess, { role: roles.find((role) => role.value === "hr") })
  );
  const workerAccess = renderToStaticMarkup(
    React.createElement(RoleAccess, { role: roles.find((role) => role.value === "worker") })
  );

  check("HR access lists payroll and leave approval", hrAccess.includes("Run payroll") && hrAccess.includes("Approve leave"));
  check("HR access says whole company", hrAccess.includes("Whole company"));
  check("Worker access does not include payroll", !workerAccess.includes("Run payroll"));
  check("Worker access is own records only", workerAccess.includes("Own records only"));

  // Onboarding — exactly three details create the account.
  const onboardModule = await server.ssrLoadModule(
    "/src/components/employee/OnboardForm.jsx"
  );
  const OnboardForm = onboardModule.default;

  const onboard = renderToStaticMarkup(
    React.createElement(OnboardForm, {
      onSubmit: () => {},
      onCancel: () => {},
      submitting: false,
    })
  );
  const inputNames = [...onboard.matchAll(/<input[^>]*name="([^"]+)"/g)].map(
    (match) => match[1]
  );
  const onboardingFields = [
    "name",
    "email",
    "phone",
  ];
  const droppedFields = [
    "username",
    "employeeId",
    "role",
    "department",
    "designation",
    "salary",
    "reportsTo",
    "dob",
    "dateOfJoining",
    "workLocation",
  ];

  check("the add form has exactly three inputs", inputNames.length === 3);
  check(
    "the add form asks for full name, work email and phone",
    onboardingFields.every((name) => inputNames.includes(name))
  );
  check(
    "no other field can be filled in while adding",
    droppedFields.every((name) => !inputNames.includes(name))
  );
  check(
    "all three add fields are required",
    (onboard.match(/required=""/g) || []).length === 3
  );
  check(
    "the add form says the staff ID and username are generated",
    onboard.includes("Staff ID") &&
      onboard.includes("username") &&
      onboard.includes("created on save")
  );
  check("the add form submits as Add worker", onboard.includes("Add worker"));

  const bareOnboard = renderToStaticMarkup(
    React.createElement(OnboardForm, { onSubmit: () => {}, bare: true })
  );
  check(
    "the popup version carries exactly one title",
    (bareOnboard.match(/Add a worker/g) || []).length === 1
  );

  check(
    "complete worker details pass validation",
    Object.keys(
      validateWorker({
        name: "Amina Juma",
        email: "amina@nilric.co.tz",
        phone: "+255 712 345 678",
      })
    ).length === 0
  );
  check(
    "a blank name is rejected",
    Boolean(validateWorker({ name: "  ", email: "a@b.co", phone: "0712345678" }).name)
  );
  check(
    "a malformed email is rejected",
    Boolean(validateWorker({ name: "Amina", email: "amina", phone: "0712345678" }).email)
  );
  check(
    "a short phone number is rejected",
    Boolean(validateWorker({ name: "Amina", email: "a@b.co", phone: "12345" }).phone)
  );

  // The profile editor keeps the full record, and nothing there is mandatory.
  const identity = render({ initialStep: 0 });

  check(
    "the profile editor still asks for the phone number",
    identity.includes("Phone number") && identity.includes('name="phone"')
  );
  check(
    "name and email are not edited from the profile",
    !identity.includes('name="name"') && !identity.includes('name="email"')
  );
  check("the profile editor offers an ID generator", identity.includes("Generate"));
  check("nothing on the profile is required", (identity.match(/required=""/g) || []).length === 0);

  // Step 2 — position
  const position = render({ initialStep: 1 });
  check("all three roles appear on the position step", labels.every((label) => position.includes(label)));
  check(
    "department, role and salary never block saving",
    (position.match(/required=""/g) || []).length === 0
  );
  check("position step has the home site picker", position.includes("Kariakoo Branch") && position.includes("Home site"));
  check("position step shows probation and contract dates", position.includes("Probation ends") && position.includes("Contract ends"));
  const designationOptions = position.match(
    /<option value="(?:Managing Director|Human Resource Manager|Worker)"/g
  ) || [];
  check(
    "designation offers exactly the three role names",
    designationOptions.length === 3 &&
      ["Managing Director", "Human Resource Manager", "Worker"].every((designation) =>
        position.includes(`value="${designation}"`)
      ) &&
      !position.includes("Accountant") &&
      !position.includes("Civil Engineer")
  );
  check(
    "each designation maps to its matching role",
    designationForRole("managing_director") === "Managing Director" &&
      designationForRole("hr") === "Human Resource Manager" &&
      designationForRole("worker") === "Worker" &&
      roleForDesignation("Human Resource Manager") === "hr"
  );

  // Step 3 — contacts
  const contacts = render({ initialStep: 2 });
  check("contacts step carries address and next of kin", contacts.includes("Personal email") && contacts.includes("Who do we call in an emergency?"));
  check("the required phone is not duplicated on the contacts step", !contacts.includes('name="phone"'));

  // Step 4 — statutory
  const statutory = render({ initialStep: 3 });
  check(
    "statutory step has NIN, NHIF and bank branch",
    statutory.includes("National ID (NIN)") && statutory.includes("NHIF / SHA number") && statutory.includes("Bank branch")
  );
  check(
    "statutory step has licence, passport and work permit",
    statutory.includes("Driving licence") && statutory.includes("Passport number") && statutory.includes("Work permit expiry")
  );

  // Step 5 — review
  const review = render({ initialStep: 4 });
  check("review step summarises the record", review.includes("Amina Juma") && review.includes("NIL-26-1234") && review.includes("TSh 850,000"));

  const minimalReview = render({
    initialStep: 4,
    initial: {
      name: "Amina Juma",
      email: "amina@nilric.co.tz",
      phone: "+255712345678",
    },
  });
  check(
    "review renders when no department or pay was given",
    minimalReview.includes("Amina Juma") && minimalReview.includes("—")
  );
  check("review step names the supervisor", review.includes("Manager"));
  check("role changes have matching designations in review", review.includes("Worker"));
  check("review step shows the access scope", review.includes("Own records only"));
  check("the retired company-visibility toggle is gone", !review.includes("Grant company-wide visibility"));

  // Suggestion helpers
  check("a team resolves to its department", parentDepartmentOf(departments, "t1")?.key === "finance");
  check(
    "the department HR is suggested for a team member",
    suggestSupervisorFor({ departments, supervisors, departmentId: "t1", role: "worker" }) === "s-hr"
  );
  check(
    "no suggestion when the department has nobody senior enough",
    suggestSupervisorFor({ departments, supervisors, departmentId: "d2", role: "hr" }) === ""
  );

  const failed = results.filter((entry) => !entry.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exitCode = failed.length === 0 ? 0 : 1;
} finally {
  await server.close();
}
