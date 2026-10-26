import { useMemo, useState } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaLock,
  FaSyncAlt,
} from "react-icons/fa";
import {
  CAPABILITIES,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  ROLE_OPTIONS,
  WORK_MODES,
  capabilityLabels,
  assignableRoles,
  hasCapability,
  roleLevel,
  designationForRole,
  roleForDesignation,
  scopeLabel,
} from "../../utils/roles";
import {
  suggestSupervisorFor,
} from "../../utils/employeeForm";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const STEPS = [
  {
    id: "identity",
    title: "Identity",
    description: "Name, staff ID and photo",
  },
  {
    id: "position",
    title: "Position",
    description: "Role, department and salary",
  },
  {
    id: "contacts",
    title: "Contacts & emergency",
    description: "Phone, address and next of kin",
  },
  {
    id: "statutory",
    title: "Statutory & documents",
    description: "NIN, payroll and qualifications",
  },
  {
    id: "access",
    title: "Access & review",
    description: "What they can see, then save",
  },
];

// Server catalogue entries use `key`; the bundled fallback uses `value`.
const normaliseRole = (role) => ({
  value: role.value ?? role.key,
  key: role.key ?? role.value,
  label: role.label,
  designation: role.designation,
  level: role.level,
  tier: role.tier,
  scope: role.scope,
  description: role.description || role.responsibilities || "",
  capabilities: role.capabilities || [],
});

const Field = ({ label, hint, children, wide = false }) => (
  <label
    className={`block text-[13px] ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}
  >
    <span className="font-medium text-slate-600">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
  </label>
);

const Section = ({ title, description, children }) => (
  <section className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {description && (
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
      )}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  </section>
);

// What the selected role is allowed to do, in plain language. Shown next to the
// picker and again on the review step so nobody grants payroll by accident.
export const RoleAccess = ({ role }) => {
  if (!role) {
    return null;
  }

  const permissions = capabilityLabels(role.capabilities);

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-brand-900">{role.label}</p>
        <p className="font-mono text-[11px] text-brand-700">
          L{role.level} · {scopeLabel(role.scope)}
        </p>
      </div>

      {role.description && (
        <p className="mt-0.5 text-[11px] leading-5 text-brand-900/70">
          {role.description}
        </p>
      )}

      {permissions.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-brand-900/60">
          No special access — own records only.
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1">
          {permissions.map((permission) => (
            <li
              key={permission}
              className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-brand-800 ring-1 ring-brand-100"
            >
              {permission}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Every Nilric role is listed. Roles at or above the signed-in user's level are
// shown but locked, so the ladder is complete and the reason is obvious.
export const RolePicker = ({ roles, value, actorRole, onSelect }) => {
  const actorLevel = roleLevel(actorRole);
  const canGrant = hasCapability(actorRole, CAPABILITIES.PEOPLE_MANAGE);
  // One horizontal ladder: executive authority first, team access last.
  const orderedRoles = [...roles].sort((left, right) => right.level - left.level);
  const assignable = roles.filter(
    (role) => canGrant && actorLevel > role.level
  ).length;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-slate-600">Role</span>
        <span className="text-[11px] text-slate-400">
          {assignable} of {roles.length} roles assignable at your level (L
          {actorLevel})
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {orderedRoles.map((role) => {
          const selected = value === role.value;
          const disabled = !canGrant || actorLevel <= role.level;
          const reason = !canGrant
            ? "You cannot assign roles"
            : `Only roles below L${actorLevel} can be assigned by you`;

          return (
            <button
                    key={role.value}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    title={disabled ? reason : role.description}
                    onClick={() => onSelect(role.value)}
                    className={`rounded-xl border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                      selected
                        ? "border-brand-700 bg-brand-700 text-white shadow-sm"
                        : disabled
                          ? "cursor-not-allowed border-slate-100 bg-slate-50/70 text-slate-400"
                          : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50/40"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          selected
                            ? "bg-white"
                            : disabled
                              ? "bg-slate-300"
                              : "bg-brand-600"
                        }`}
                      />
                      <span className="truncate text-[13px] font-semibold">
                        {role.label}
                      </span>
                      {disabled ? (
                        <FaLock
                          aria-hidden="true"
                          className="ml-auto shrink-0 text-[10px]"
                        />
                      ) : selected ? (
                        <FaCheck
                          aria-hidden="true"
                          className="ml-auto shrink-0 text-[10px]"
                        />
                      ) : null}
                    </span>

                    <span
                      className={`mt-1 flex items-center gap-1.5 pl-3.5 text-[11px] ${
                        selected ? "text-brand-100" : "text-slate-500"
                      }`}
                    >
                      <span className="font-mono">L{role.level}</span>
                      <span aria-hidden="true">·</span>
                      <span>{scopeLabel(role.scope)}</span>
                    </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] leading-5 text-slate-400">
        Seniority is enforced by the server. Locked roles belong to people at or
        above your level and must be created by someone more senior.
      </p>
    </div>
  );
};

const SummaryRow = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-[11px] text-slate-500">{label}</dt>
    <dd className="truncate text-[13px] font-medium text-slate-900">
      {value || "—"}
    </dd>
  </div>
);

const EmployeeForm = ({
  initial = {},
  mode = "edit",
  departments = [],
  supervisors = [],
  locations = [],
  roleCatalog = [],
  currentUserRole,
  canEditRole = true,
  submitting,
  successMessage,
  onSubmit,
  onCancel,
  submitLabel,
  bare = false,
  // Deep links can open the form on a specific step (for example the access
  // review) instead of always starting at identity.
  initialStep = 0,
}) => {
  const startStep = Math.min(
    Math.max(Number(initialStep) || 0, 0),
    STEPS.length - 1
  );

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    employeeId: "",
    dob: "",
    gender: "",
    maritalStatus: "",
    designation: "",
    department: "",
    salary: "",
    role: "worker",
    reportsTo: "",
    employmentType: "Full-time",
    employmentStatus: "Active",
    workMode: "Office",
    workLocation: "",
    dateOfJoining: "",
    contractEndDate: "",
    probationEndDate: "",
    phone: "",
    personalEmail: "",
    address: "",
    city: "",
    region: "",
    nationalId: "",
    tin: "",
    nssfNumber: "",
    nhifNumber: "",
    bankName: "",
    bankBranch: "",
    bankAccountName: "",
    bankAccountNumber: "",
    drivingLicenceNumber: "",
    passportNumber: "",
    workPermitExpiry: "",
    qualification: "",
    fieldOfStudy: "",
    certifications: "",
    skills: "",
    notes: "",
    "emergencyContact.name": "",
    "emergencyContact.relationship": "",
    "emergencyContact.phone": "",
    ...initial,
  });

  const [image, setImage] = useState(null);
  const [step, setStep] = useState(startStep);
  const [maxReached, setMaxReached] = useState(startStep);

  // The live catalogue comes from /api/org/structure. The bundled copy is only
  // a fallback for the first render or a failed request.
  const roles = useMemo(() => {
    const source = roleCatalog?.length ? roleCatalog : ROLE_OPTIONS;

    return source
      .map(normaliseRole)
      .sort((a, b) => b.level - a.level);
  }, [roleCatalog]);

  const selectedRole = roles.find((role) => role.value === form.role) || null;

  const selectedRoleLevel = roleLevel(form.role);

  const supervisorOptions = useMemo(
    () =>
      supervisors
        .filter((supervisor) => supervisor.level > selectedRoleLevel)
        .sort((a, b) => b.level - a.level),
    [supervisors, selectedRoleLevel]
  );

  const departmentGroups = useMemo(() => {
    const parents = departments.filter((entry) => entry.kind !== "team");
    const teams = departments.filter((entry) => entry.kind === "team");

    return parents.map((parent) => ({
      ...parent,
      teams: teams.filter(
        (team) => team.parent === parent._id || team.parent?._id === parent._id
      ),
    }));
  }, [departments]);

  const selectedDepartment = departments.find(
    (entry) => entry._id === form.department
  );
  const selectedSupervisor = supervisors.find(
    (supervisor) => supervisor._id === form.reportsTo
  );
  const selectedLocation = locations.find(
    (location) => location._id === form.workLocation
  );

  // The designation catalogue mirrors the three access roles, so choosing a
  // designation also selects the matching role.
  const designationOptions = useMemo(
    () => roles.filter((role) => role.designation),
    [roles]
  );
  const assignableRoleKeys = assignableRoles(currentUserRole);

  const change = (event) => {
    const { name, value, files, checked, type } = event.target;

    if (name === "image") {
      setImage(files?.[0] || null);
      return;
    }

    if (type === "checkbox") {
      setForm((current) => ({ ...current, [name]: checked }));
      return;
    }

    if (name === "designation") {
      const nextRole = roleForDesignation(value);

      if (nextRole) {
        chooseRole(nextRole);
      }

      return;
    }

    if (name === "department") {
      setForm((current) => {
        const next = { ...current, department: value };

        if (!current.reportsTo) {
          next.reportsTo = suggestSupervisorFor({
            departments,
            supervisors,
            departmentId: value,
            role: current.role,
          });
        }

        return next;
      });
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  };

  const chooseRole = (nextRole) => {
    setForm((current) => {
      const supervisor = supervisors.find(
        (entry) => entry._id === current.reportsTo
      );

      return {
        ...current,
        role: nextRole,
        designation: designationForRole(nextRole),
        // A supervisor who is no longer senior enough is cleared rather than
        // left in the form to be rejected on save.
        reportsTo:
          supervisor && supervisor.level > roleLevel(nextRole)
            ? current.reportsTo
            : "",
      };
    });
  };

  const generateEmployeeId = () => {
    const year = String(new Date().getFullYear()).slice(-2);
    const digits = String(Math.floor(1000 + Math.random() * 9000));

    setForm((current) => ({ ...current, employeeId: `NIL-${year}-${digits}` }));
  };

  const goToStep = (index) => {
    if (index < 0 || index >= STEPS.length) {
      return;
    }

    setStep(index);
    setMaxReached((reached) => Math.max(reached, index));
  };

  // Nothing on the profile is mandatory once the person exists, so every step
  // can be saved from here.
  const submit = (event) => {
    event.preventDefault();

    onSubmit(form, image);
  };

  // Enter in a text field should not save the form. Only the Save button may submit.
  const blockEnterSubmit = (event) => {
    if (event.key === "Enter" && event.target.tagName === "INPUT") {
      event.preventDefault();
    }
  };

  const isLastStep = step === STEPS.length - 1;

  const identityFields = (
    <Section
      title="Identity"
      description="How to reach this person. Their name, email and login were set when the account was created."
    >
        {mode === "edit" && (
          <Field label="Work email">
            <input
              value={form.email}
              readOnly
              aria-readonly="true"
              className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
            />
          </Field>
      )}

      <Field
        label="Phone number"
        hint="Used to reach the worker on site."
      >
        <input
          name="phone"
          type="tel"
          value={form.phone}
          onChange={change}
          autoComplete="tel"
          placeholder="+255 …"
          className={`${inputClass} font-mono`}
        />
      </Field>

      <Field
        label="Employee ID"
        hint="Optional — generated if left blank."
      >
        <span className="flex items-center gap-1.5">
          <input
            name="employeeId"
            value={form.employeeId}
            onChange={change}
            placeholder="e.g. NIL-0123"
            className={inputClass}
          />
          <button
            type="button"
            onClick={generateEmployeeId}
            title="Generate an ID you can edit"
            className="mt-1 inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <FaSyncAlt aria-hidden="true" className="text-[10px]" />
            Generate
          </button>
        </span>
      </Field>

      <Field label="Date of birth">
        <input
          name="dob"
          type="date"
          value={form.dob ? String(form.dob).slice(0, 10) : ""}
          onChange={change}
          className={inputClass}
        />
      </Field>

      <Field label="Gender">
        <select
          name="gender"
          value={form.gender}
          onChange={change}
          className={inputClass}
        >
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </Field>

      <Field label="Marital status">
        <select
          name="maritalStatus"
          value={form.maritalStatus}
          onChange={change}
          className={inputClass}
        >
          <option value="">Select status</option>
          <option value="Single">Single</option>
          <option value="Married">Married</option>
          <option value="Divorced">Divorced</option>
          <option value="Widowed">Widowed</option>
        </select>
      </Field>

      <Field
        label="Profile photo"
        hint="JPG or PNG, up to 5 MB. Leave empty to keep the current photo."
      >
        <input
          name="image"
          type="file"
          accept="image/*"
          onChange={change}
          className="mt-1 w-full cursor-pointer rounded-lg border border-slate-200 p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
      </Field>
    </Section>
  );

  const positionFields = (
    <>
      <section className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-800">
            What can they do?
          </h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            Choose one of three access roles. The MD can assign HR or Worker;
            HR can assign Worker. Department and job title set their place on
            the organisation chart.
          </p>
        </div>

        {canEditRole ? (
          <RolePicker
            roles={roles}
            value={form.role}
            actorRole={currentUserRole}
            onSelect={chooseRole}
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-800">{selectedRole?.label || "Worker"}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Your level does not allow changing this employee’s role.
            </p>
          </div>
        )}

        <div className="mt-3">
          <RoleAccess role={selectedRole} />
        </div>
      </section>

      <Section title="Where do they sit?">
        <Field
          label="Designation"
          hint="Designation matches the access role. Choose the role above to update it."
        >
          <select
            name="designation"
            value={form.designation}
            onChange={change}
            className={inputClass}
          >
            {designationOptions.map((role) => (
              <option
                key={role.designation}
                value={role.designation}
                disabled={!assignableRoleKeys.includes(role.value)}
              >
                {role.designation}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Department or team"
          hint="Optional — assign it once the worker is placed."
        >
          <select
            name="department"
            value={form.department}
            onChange={change}
            className={inputClass}
          >
            <option value="">Not assigned yet</option>
            {departmentGroups.map((parent) => (
              <optgroup key={parent._id} label={parent.dep_name}>
                <option value={parent._id}>{parent.dep_name}</option>
                {parent.teams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.dep_name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field
          label="Reports to"
          hint={
            selectedDepartment
              ? "Suggested from the department; change it if needed."
              : "Supervisor must be senior to the selected role."
          }
        >
          <select
            name="reportsTo"
            value={form.reportsTo || ""}
            onChange={change}
            className={inputClass}
          >
            <option value="">Not set</option>
            {supervisorOptions.map((supervisor) => (
              <option key={supervisor._id} value={supervisor._id}>
                {supervisor.name} · {supervisor.roleLabel || supervisor.role}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Employment type">
          <select
            name="employmentType"
            value={form.employmentType}
            onChange={change}
            className={inputClass}
          >
            {EMPLOYMENT_TYPES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Employment status"
          hint="Choose Probation for new hires; set the end date below."
        >
          <select
            name="employmentStatus"
            value={form.employmentStatus}
            onChange={change}
            className={inputClass}
          >
            {EMPLOYMENT_STATUSES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Attendance mode"
          hint="Field and remote check-ins skip the geofence."
        >
          <select
            name="workMode"
            value={form.workMode}
            onChange={change}
            className={inputClass}
          >
            {WORK_MODES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Home site"
          hint={
            selectedLocation
              ? `${selectedLocation.name}${selectedLocation.address ? ` — ${selectedLocation.address}` : ""}`
              : "Where they normally report. GPS still accepts any Nilric site."
          }
        >
          <select
            name="workLocation"
            value={form.workLocation || ""}
            onChange={change}
            className={inputClass}
          >
            <option value="">Not assigned</option>
            {locations.map((location) => (
              <option key={location._id} value={location._id}>
                {location.name}
                {location.isPrimary ? " (main)" : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date joined">
          <input
            name="dateOfJoining"
            type="date"
            value={
              form.dateOfJoining ? String(form.dateOfJoining).slice(0, 10) : ""
            }
            onChange={change}
            className={inputClass}
          />
        </Field>

        <Field label="Probation ends">
          <input
            name="probationEndDate"
            type="date"
            value={
              form.probationEndDate
                ? String(form.probationEndDate).slice(0, 10)
                : ""
            }
            onChange={change}
            className={inputClass}
          />
        </Field>

        <Field label="Contract ends" hint="Leave empty for permanent staff.">
          <input
            name="contractEndDate"
            type="date"
            value={
              form.contractEndDate
                ? String(form.contractEndDate).slice(0, 10)
                : ""
            }
            onChange={change}
            className={inputClass}
          />
        </Field>

        <Field
          label="Monthly salary (TSh)"
          hint="Optional — payroll can set it later."
        >
          <input
            name="salary"
            type="number"
            min="0"
            value={form.salary}
            onChange={change}
            placeholder="e.g. 850000"
            className={`${inputClass} font-mono`}
          />
        </Field>
      </Section>
    </>
  );

  const contactsFields = (
    <>
      <Section title="How do we reach them?">
        <Field
          label="Personal email"
          hint="The employee must verify this address from Login Settings before it works for sign-in."
        >
          <input
            name="personalEmail"
            type="email"
            value={form.personalEmail}
            onChange={change}
            className={inputClass}
          />
        </Field>

        <Field label="Address" wide>
          <input
            name="address"
            value={form.address}
            onChange={change}
            placeholder="Street, plot, apartment"
            className={inputClass}
          />
        </Field>

        <Field label="City">
          <input
            name="city"
            value={form.city}
            onChange={change}
            placeholder="Dar es Salaam"
            className={inputClass}
          />
        </Field>

        <Field label="Region">
          <input
            name="region"
            value={form.region}
            onChange={change}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section
        title="Who do we call in an emergency?"
        description="Someone reachable if the employee cannot be."
      >
        <Field label="Name">
          <input
            name="emergencyContact.name"
            value={form["emergencyContact.name"]}
            onChange={change}
            className={inputClass}
          />
        </Field>

        <Field label="Relationship">
          <input
            name="emergencyContact.relationship"
            value={form["emergencyContact.relationship"]}
            onChange={change}
            placeholder="Spouse, parent, sibling"
            className={inputClass}
          />
        </Field>

        <Field label="Phone">
          <input
            name="emergencyContact.phone"
            value={form["emergencyContact.phone"]}
            onChange={change}
            className={`${inputClass} font-mono`}
          />
        </Field>
      </Section>
    </>
  );

  const statutoryFields = (
    <>
      <Section
        title="Statutory and payroll"
        description="Tanzanian statutory identifiers and the account salary is paid into."
      >
        <Field label="National ID (NIN)">
          <input
            name="nationalId"
            value={form.nationalId}
            onChange={change}
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field label="TIN">
          <input
            name="tin"
            value={form.tin}
            onChange={change}
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field label="NSSF number">
          <input
            name="nssfNumber"
            value={form.nssfNumber}
            onChange={change}
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field label="NHIF / SHA number">
          <input
            name="nhifNumber"
            value={form.nhifNumber}
            onChange={change}
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field label="Bank">
          <input
            name="bankName"
            value={form.bankName}
            onChange={change}
            placeholder="e.g. NMB, CRDB"
            className={inputClass}
          />
        </Field>

        <Field label="Bank branch">
          <input
            name="bankBranch"
            value={form.bankBranch}
            onChange={change}
            placeholder="e.g. Samora Avenue"
            className={inputClass}
          />
        </Field>

        <Field label="Account name">
          <input
            name="bankAccountName"
            value={form.bankAccountName}
            onChange={change}
            className={inputClass}
          />
        </Field>

        <Field label="Account number">
          <input
            name="bankAccountNumber"
            value={form.bankAccountNumber}
            onChange={change}
            className={`${inputClass} font-mono`}
          />
        </Field>
      </Section>

      <Section
        title="Identification documents"
        description="Needed for site access, driving company vehicles and work permits."
      >
        <Field label="Driving licence" hint="Field engineers and drivers.">
          <input
            name="drivingLicenceNumber"
            value={form.drivingLicenceNumber}
            onChange={change}
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field label="Passport number">
          <input
            name="passportNumber"
            value={form.passportNumber}
            onChange={change}
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field label="Work permit expiry" hint="For non-Tanzanian staff.">
          <input
            name="workPermitExpiry"
            type="date"
            value={
              form.workPermitExpiry
                ? String(form.workPermitExpiry).slice(0, 10)
                : ""
            }
            onChange={change}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="What can they do?">
        <Field label="Highest qualification">
          <input
            name="qualification"
            value={form.qualification}
            onChange={change}
            placeholder="BSc, Diploma, Certificate"
            className={inputClass}
          />
        </Field>

        <Field label="Field of study">
          <input
            name="fieldOfStudy"
            value={form.fieldOfStudy}
            onChange={change}
            className={inputClass}
          />
        </Field>

        <Field label="Certifications" hint="Separate with commas." wide>
          <input
            name="certifications"
            value={form.certifications}
            onChange={change}
            placeholder="PMP, CCNA, OSHA"
            className={inputClass}
          />
        </Field>

        <Field label="Skills" hint="Separate with commas." wide>
          <input
            name="skills"
            value={form.skills}
            onChange={change}
            placeholder="Network design, HVAC, contract management"
            className={inputClass}
          />
        </Field>

        <Field label="Notes" wide>
          <textarea
            name="notes"
            value={form.notes}
            onChange={change}
            rows={2}
            className={inputClass}
          />
        </Field>
      </Section>
    </>
  );

  const accessFields = (
    <>
      <Section
        title="Access this role grants"
        description="Check this before saving. Access follows the role, not the person."
      >
        <div className="sm:col-span-2 lg:col-span-3">
          <RoleAccess role={selectedRole} />
        </div>
      </Section>

      <Section
        title="Review"
        description="This is what will be saved to the personnel file."
      >
        <div className="sm:col-span-2 lg:col-span-3">
          <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryRow label="Name" value={form.name} />
            <SummaryRow label="Work email" value={form.email} />
            <SummaryRow label="Employee ID" value={form.employeeId} />
            <SummaryRow
              label="Role"
              value={
                selectedRole
                  ? `${selectedRole.label} · L${selectedRole.level}`
                  : ""
              }
            />
            <SummaryRow
              label="Department"
              value={selectedDepartment?.dep_name}
            />
            <SummaryRow
              label="Designation"
              value={form.designation}
            />
            <SummaryRow
              label="Reports to"
              value={
                selectedSupervisor
                  ? `${selectedSupervisor.name} · ${selectedSupervisor.roleLabel}`
                  : "Not set"
              }
            />
            <SummaryRow
              label="Home site"
              value={selectedLocation?.name || "Not assigned"}
            />
            <SummaryRow
              label="Employment"
              value={`${form.employmentType} · ${form.employmentStatus}`}
            />
            <SummaryRow
              label="Date joined"
              value={form.dateOfJoining}
            />
            <SummaryRow
              label="Monthly salary"
              value={
                form.salary
                  ? `TSh ${Number(form.salary).toLocaleString("en-GB")}`
                  : ""
              }
            />
            <SummaryRow
              label="Access"
              value={scopeLabel(selectedRole?.scope)}
            />
          </dl>
        </div>
      </Section>
    </>
  );

  const stepContent = [
    identityFields,
    positionFields,
    contactsFields,
    statutoryFields,
    accessFields,
  ][step];

  return (
    <form
      onSubmit={submit}
      onKeyDown={blockEnterSubmit}
      className={
        bare
          ? ""
          : "mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6"
      }
    >
      <ol className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STEPS.map((entry, index) => {
          const visited = index < step;
          const current = index === step;
          const reachable = index <= maxReached;

          return (
            <li key={entry.id}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => goToStep(index)}
                aria-current={current ? "step" : undefined}
                className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                  current
                    ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                    : visited
                      ? "border-slate-200 bg-white hover:border-brand-300"
                      : "cursor-not-allowed border-slate-100 bg-slate-50/60 opacity-70"
                } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    current
                      ? "bg-brand-700 text-white"
                      : visited
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {visited ? <FaCheck /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-xs font-semibold sm:text-[12px] ${
                      current ? "text-brand-900" : "text-slate-700"
                    }`}
                  >
                    {entry.title}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {successMessage && (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {successMessage}
        </p>
      )}

      <div key={step}>
        <div className="mb-3 sm:hidden">
          <p className="text-xs font-medium text-slate-400">
            Step {step + 1} of {STEPS.length}
          </p>
          <p className="text-base font-semibold text-slate-900">
            {STEPS[step].title}
          </p>
          <p className="text-xs text-slate-500">{STEPS[step].description}</p>
        </div>

        <div className="space-y-4">{stepContent}</div>
      </div>

      <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white pb-1 pt-4">
        <div>
          {step > 0 ? (
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <FaArrowLeft aria-hidden="true" className="text-xs" />
              Back
            </button>
          ) : (
            onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Cancel
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs tabular-nums text-slate-400 sm:block">
            Step {step + 1} of {STEPS.length}
          </span>

          {!isLastStep && (
            <button
              type="button"
              onClick={() => goToStep(step + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-brand-700 px-5 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Continue
              <FaArrowRight aria-hidden="true" className="text-xs" />
            </button>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "Saving…" : submitLabel || "Save employee"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default EmployeeForm;
