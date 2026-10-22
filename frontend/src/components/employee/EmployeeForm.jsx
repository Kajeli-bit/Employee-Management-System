import { useMemo, useState } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
} from "react-icons/fa";
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  WORK_MODES,
  assignableRoles,
  getRole,
  roleLevel,
} from "../../utils/roles";

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
    title: "Statutory & qualifications",
    description: "NIN, payroll and skills",
  },
];

const REQUIRED_LABELS = {
  name: "full name",
  username: "username",
  email: "work email",
  employeeId: "employee ID",
  department: "department or team",
  salary: "monthly salary",
};

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

const EmployeeForm = ({
  mode = "create",
  initial = {},
  departments = [],
  supervisors = [],
  jobTitles = [],
  currentUserRole,
  submitting,
  successMessage,
  onSubmit,
  onCancel,
  submitLabel,
  bare = false,
}) => {
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
    role: "employee",
    reportsTo: "",
    employmentType: "Full-time",
    employmentStatus: "Active",
    workMode: "Office",
    dateOfJoining: "",
    contractEndDate: "",
    phone: "",
    personalEmail: "",
    address: "",
    city: "",
    region: "",
    nationalId: "",
    tin: "",
    nssfNumber: "",
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
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
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [stepError, setStepError] = useState("");

  const availableRoles = useMemo(() => {
    const roles = assignableRoles(currentUserRole);

    if (mode === "edit" && initial.role) {
      const existing = roles.find((role) => role.value === initial.role);

      if (!existing) {
        const current = getRole(initial.role);

        if (current) {
          roles.push({ value: current.key, label: current.label, ...current });
        }
      }
    }

    return roles;
  }, [currentUserRole, initial.role, mode]);

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

  const change = (event) => {
    const { name, value, files } = event.target;

    if (name === "image") {
      setImage(files?.[0] || null);
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  };

  const requiredForStep = (stepIndex) => {
    if (stepIndex === 0) {
      return mode === "create"
        ? ["name", "username", "email", "employeeId"]
        : ["employeeId"];
    }

    if (stepIndex === 1) {
      return ["department", "salary"];
    }

    return [];
  };

  const goToStep = (index) => {
    if (index < 0 || index >= STEPS.length) {
      return;
    }

    if (index > maxReached) {
      const missing = requiredForStep(step).find(
        (field) => !String(form[field] ?? "").trim()
      );

      if (missing) {
        setStepError(
          `Enter the employee's ${REQUIRED_LABELS[missing]} to continue.`
        );
        return;
      }
    }

    setStepError("");
    setStep(index);
    setMaxReached((reached) => Math.max(reached, index));
  };

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
      title={mode === "create" ? "Who is joining?" : "Identity"}
      description={
        mode === "create"
          ? "The work email becomes the login for the employee portal."
          : undefined
      }
    >
      {mode === "create" && (
        <>
          <Field label="Full name">
            <input
              name="name"
              value={form.name}
              onChange={change}
              required
              autoComplete="name"
              placeholder="e.g. Amina Juma"
              className={inputClass}
            />
          </Field>

          <Field label="Username">
            <input
              name="username"
              value={form.username}
              onChange={change}
              required
              autoComplete="username"
              placeholder="e.g. amina.juma"
              className={inputClass}
            />
          </Field>

          <Field label="Work email" hint="Used for OTP sign-in.">
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={change}
              required
              autoComplete="email"
              placeholder="name@nilric.co.tz"
              className={inputClass}
            />
          </Field>
        </>
      )}

      <Field label="Employee ID" hint="Must be unique across Nilric.">
        <input
          name="employeeId"
          value={form.employeeId}
          onChange={change}
          required
          placeholder="e.g. NIL-0123"
          className={inputClass}
        />
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
        hint={mode === "edit" ? "Leave empty to keep the current photo." : "JPG or PNG, up to 5 MB."}
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
    <Section
      title="Where do they sit?"
      description="Role sets access. The department places the person on the organisation chart."
    >
      <Field label="Role">
        <select
          name="role"
          value={form.role}
          onChange={change}
          required
          className={inputClass}
        >
          <option value="">Select role</option>
          {availableRoles.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label} · L{role.level}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Designation" hint="Job title, e.g. Mechanical Engineer.">
        <input
          name="designation"
          value={form.designation}
          onChange={change}
          list="nilric-job-titles"
          className={inputClass}
        />
        <datalist id="nilric-job-titles">
          {jobTitles.map((entry) => (
            <option key={entry.title} value={entry.title} />
          ))}
        </datalist>
      </Field>

      <Field label="Department or team">
        <select
          name="department"
          value={form.department}
          onChange={change}
          required
          className={inputClass}
        >
          <option value="">Select department</option>
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
        hint="Supervisor must be senior to the selected role."
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
              {supervisor.name} · {supervisor.roleLabel}
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

      <Field label="Employment status">
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

      <Field label="Contract ends">
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

      <Field label="Monthly salary (TSh)">
        <input
          name="salary"
          type="number"
          min="0"
          value={form.salary}
          onChange={change}
          required
          placeholder="e.g. 850000"
          className={`${inputClass} font-mono`}
        />
      </Field>
    </Section>
  );

  const contactsFields = (
    <>
      <Section title="How do we reach them?">
        <Field label="Phone">
          <input
            name="phone"
            value={form.phone}
            onChange={change}
            placeholder="+255 …"
            autoComplete="tel"
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field label="Personal email">
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
        description="Tanzanian statutory identifiers and the bank account used for salary."
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

        <Field label="Bank">
          <input
            name="bankName"
            value={form.bankName}
            onChange={change}
            placeholder="e.g. NMB, CRDB"
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

  const stepContent = [
    identityFields,
    positionFields,
    contactsFields,
    statutoryFields,
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
      <ol className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                    className={`block truncate text-xs font-semibold sm:text-[13px] ${
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

      {stepError && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
        >
          {stepError}
        </p>
      )}

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
