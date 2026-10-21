import { useMemo, useState } from "react";
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  WORK_MODES,
  assignableRoles,
  getRole,
  roleLevel,
} from "../../utils/roles";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const Field = ({ label, hint, children, wide = false }) => (
  <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>
    <span className="font-medium text-slate-600">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
  </label>
);

const Section = ({ title, description, children }) => (
  <section className="border-t border-slate-100 pt-5 first:border-0 first:pt-0">
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {description && (
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      )}
    </div>
    <div className="grid gap-4 sm:grid-cols-2">{children}</div>
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

  const submit = (event) => {
    event.preventDefault();
    onSubmit(form, image);
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {mode === "create" ? "Add employee" : "Edit employee profile"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Nilric General Traders · employment, contact and statutory record
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {getRole(form.role)?.label || "Employee"}
        </span>
      </div>

      {successMessage && (
        <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {successMessage}
        </p>
      )}

      <div className="space-y-6">
        <Section
          title="Identity"
          description="The email becomes the login for the employee portal."
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
                  className={inputClass}
                />
              </Field>
            </>
          )}

          <Field label="Employee ID">
            <input
              name="employeeId"
              value={form.employeeId}
              onChange={change}
              required
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

        <Section
          title="Position"
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
              className={`${inputClass} font-mono`}
            />
          </Field>
        </Section>

        <Section title="Contact">
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

        <Section title="Emergency contact">
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

        <Section title="Qualifications">
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
              rows={3}
              className={inputClass}
            />
          </Field>
        </Section>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "Saving…" : submitLabel || "Save employee"}
        </button>
      </div>
    </form>
  );
};

export default EmployeeForm;
