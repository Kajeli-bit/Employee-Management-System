import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  FaArrowLeft,
  FaBriefcase,
  FaEnvelope,
  FaPen,
  FaTrashAlt,
} from "react-icons/fa";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { formatCurrency } from "../../utils/format";
import { canManageRole, roleLabel } from "../../utils/roles";
import {
  buildRecordGroups,
  completenessOf,
  missingFields,
} from "./recordFields";

const initialsOf = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const STATUS_TONE = {
  Active: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30",
  Probation: "bg-amber-400/15 text-amber-200 ring-amber-400/30",
  "On Leave": "bg-sky-400/15 text-sky-200 ring-sky-400/30",
  Suspended: "bg-rose-400/15 text-rose-200 ring-rose-400/30",
  Exited: "bg-slate-400/15 text-slate-300 ring-slate-400/30",
};

const STATUS_DOT = {
  Active: "bg-emerald-400",
  Probation: "bg-amber-400",
  "On Leave": "bg-sky-400",
  Suspended: "bg-rose-400",
  Exited: "bg-slate-400",
};

// A record field. Identifiers and figures get the mono face because they are
// data to be read carefully; prose stays in the sans face.
const Field = ({ label, value, mono = false, wide = false }) => (
  <div className={wide ? "sm:col-span-2" : undefined}>
    <dt className="text-xs font-medium text-slate-500">{label}</dt>
    <dd
      className={`mt-0.5 text-sm ${
        mono
          ? "font-mono tabular-nums text-slate-900"
          : "font-medium text-slate-900"
      }`}
    >
      {value}
    </dd>
  </div>
);

// Groups print only what has been recorded. An empty group is a single quiet
// line, not a grid of dashes — a personnel file should read like a document
// with blanks, not like a broken form.
const Group = ({ title, entries }) => (
  <section className="mt-6 first:mt-0">
    <h2 className="border-b border-slate-200 pb-2 text-sm font-semibold text-brand-900">
      {title}
    </h2>

    {entries.length === 0 ? (
      <p className="pt-3 text-sm text-slate-400">Nothing recorded yet.</p>
    ) : (
      <dl className="grid gap-x-8 gap-y-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <Field key={entry.label} {...entry} />
        ))}
      </dl>
    )}
  </section>
);

const View = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, getToken } = useAuth();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchEmployee = async () => {
      try {
        const token = await getToken();

        if (!token) {
          setError("Your session expired. Sign in again to view this record.");
          setLoading(false);
          return;
        }

        const response = await axios.get(`${API_URL}/api/employee/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!cancelled && response.data.success) {
          setEmployee(response.data.employee);
        }
      } catch (fetchError) {
        if (cancelled) {
          return;
        }

        console.log(
          "FETCH EMPLOYEE ERROR:",
          fetchError.response?.status,
          fetchError.response?.data || fetchError.message
        );

        setError(
          fetchError.response?.status === 403
            ? "You do not have access to this employee's record."
            : fetchError.response?.data?.error ||
              "The employee record could not be loaded."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (getToken && id) {
      fetchEmployee();
    }

    return () => {
      cancelled = true;
    };
  }, [id, getToken]);

  const handleDeleteEmployee = async () => {
    const employeeName = employee?.userId?.name || "this employee";

    const confirmed = window.confirm(
      `Delete ${employeeName}? This removes their login account, salary, leave and attendance records. It cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);

      const token = await getToken();

      if (!token) {
        setError("Your session expired. Sign in again to delete this record.");
        return;
      }

      const response = await axios.delete(`${API_URL}/api/employee/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        navigate("/admin-dashboard/employees");
      }
    } catch (deleteError) {
      console.log(
        "DELETE EMPLOYEE ERROR:",
        deleteError.response?.status,
        deleteError.response?.data || deleteError.message
      );

      setError(
        deleteError.response?.data?.error ||
          "The employee could not be deleted."
      );
    } finally {
      setDeleting(false);
    }
  };

  const person = employee?.userId;

  const canManage = person?.role
    ? canManageRole(user?.role, person.role)
    : false;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <div className="h-96 rounded-2xl bg-slate-200" />
            <div className="h-96 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-16 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">
            {error ? "This record is unavailable" : "Employee not found"}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-500">
            {error || "The employee may have been removed, or the link is out of date."}
          </p>
          <Link
            to="/admin-dashboard/employees"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <FaArrowLeft aria-hidden="true" className="text-xs" />
            Back to employees
          </Link>
        </div>
      </div>
    );
  }

  const department = employee.department?.dep_name || "";
  const status = employee.employmentStatus;

  const recordGroups = buildRecordGroups(employee, person);
  const missing = missingFields(recordGroups);
  const { percent: completeness, tracked } = completenessOf(recordGroups);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin-dashboard/employees"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <FaArrowLeft aria-hidden="true" className="text-xs" />
          All employees
        </Link>

        {canManage && (
          <Link
            to={`/admin-dashboard/employees/edit/${employee._id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <FaPen aria-hidden="true" className="text-[11px]" />
            Edit profile
          </Link>
        )}
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[340px_1fr]">
        {/* Identity plate: the one place the page spends its colour. */}
        <aside className="overflow-hidden rounded-2xl bg-brand-950 text-white shadow-sm lg:sticky lg:top-6">
          <div
            className="px-6 pb-6 pt-7"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          >
            {person?.profileImage ? (
              <img
                src={person.profileImage}
                alt={person?.name || "Employee"}
                className="h-24 w-24 rounded-2xl object-cover ring-1 ring-white/25"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-24 w-24 items-center justify-center rounded-2xl bg-brand-800 text-3xl font-semibold tracking-wide text-brand-200 ring-1 ring-white/15"
              >
                {initialsOf(person?.name) || "—"}
              </div>
            )}

            <h1 className="mt-4 text-3xl font-semibold leading-[1.1] tracking-tight">
              {person?.name || "Unnamed employee"}
            </h1>

            <p className="mt-1 flex items-center gap-2 text-sm text-brand-200">
              <FaBriefcase aria-hidden="true" className="text-[11px]" />
              {employee.designation || roleLabel(person?.role)}
            </p>

            <p className="mt-3 font-mono text-xs tracking-wider text-brand-300">
              {employee.employeeId}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {status && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                    STATUS_TONE[status] ||
                    "bg-white/10 text-slate-200 ring-white/20"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                      STATUS_DOT[status] || "bg-slate-400"
                    }`}
                  />
                  {status}
                </span>
              )}

              {department && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-brand-100 ring-1 ring-white/15">
                  {department}
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 px-6 py-5">
            <p className="text-xs font-medium text-brand-300">Monthly salary</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums tracking-tight">
              {formatCurrency(employee.salary)}
            </p>

            {person?.email && (
              <a
                href={`mailto:${person.email}`}
                className="mt-4 flex items-center gap-2 truncate text-xs text-brand-200 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
              >
                <FaEnvelope aria-hidden="true" className="shrink-0 text-[11px]" />
                <span className="truncate">{person.email}</span>
              </a>
            )}
          </div>

          <div className="border-t border-white/10 bg-black/15 px-6 py-4">
            <div className="flex items-baseline justify-between text-[11px] text-brand-300">
              <span>Personnel file</span>
              <span className="font-mono tabular-nums">{completeness}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={completeness}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Share of the personnel file recorded"
              className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15"
            >
              <div
                className="h-full rounded-full bg-brand-300"
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>
        </aside>

        {/* Record sheet: quiet, continuous, grouped. */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {recordGroups.map((group) => (
            <Group
              key={group.title}
              title={group.title}
              entries={group.fields.filter((field) => Boolean(field.value))}
            />
          ))}

          {missing.length > 0 && canManage && (
            <section className="mt-7 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Still to record
                </h2>
                <span className="font-mono text-[11px] tabular-nums text-slate-500">
                  {missing.length} of {tracked}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                These details are blank on the personnel file.
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {missing.map((entry) => (
                  <li
                    key={`${entry.group}-${entry.label}`}
                    title={entry.group}
                    className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200"
                  >
                    {entry.label}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {canManage && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <p className="text-xs leading-5 text-slate-500">
                Deleting removes this person's login, salary, leave and
                attendance history.
              </p>
              <button
                type="button"
                onClick={handleDeleteEmployee}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaTrashAlt aria-hidden="true" className="text-[11px]" />
                {deleting ? "Deleting…" : "Delete employee"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default View;
