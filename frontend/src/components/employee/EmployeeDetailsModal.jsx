import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  FaBriefcase,
  FaPen,
  FaTimes,
} from "react-icons/fa";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { canManageRole, roleLabel } from "../../utils/roles";
import Loader from "../common/Loader";
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

const EmployeeDetailsModal = ({
  employeeId,
  onClose,
  onEdit,
  active = true,
  refreshKey = 0,
}) => {
  const { user, getToken } = useAuth();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // While a popup is stacked on top (e.g. Edit), this one is inactive so
  // Escape only closes the top popup and the page scroll stays locked.
  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, active]);

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

        const response = await axios.get(
          `${API_URL}/api/employee/${employeeId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!cancelled && response.data.success) {
          setEmployee(response.data.employee);
        }
      } catch (fetchError) {
        if (cancelled) {
          return;
        }

        console.log(
          "EMPLOYEE DETAILS ERROR:",
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

    if (employeeId && getToken) {
      fetchEmployee();
    }

    return () => {
      cancelled = true;
    };
  }, [employeeId, getToken, refreshKey]);

  const person = employee?.userId;
  const groups = employee ? buildRecordGroups(employee, person) : [];
  const missing = employee ? missingFields(groups) : [];
  const { percent, tracked } = employee
    ? completenessOf(groups)
    : { percent: 0, tracked: 0 };
  const canManage = person?.role
    ? canManageRole(user?.role, person.role)
    : false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Employee details"
      className="fixed inset-0 left-0 z-50 flex items-center justify-center p-3 sm:p-5 lg:left-64"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-md"
      />

      <div className="relative flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Identity band: the header is the person, not a page title. */}
        <div
          className="shrink-0 px-5 py-4 text-white sm:px-6"
          style={{
            backgroundColor: "#271136",
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          <div className="flex items-start gap-4">
            {person?.profileImage ? (
              <img
                src={person.profileImage}
                alt={person?.name || "Employee"}
                className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-white/25"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-800 text-lg font-semibold text-brand-200 ring-1 ring-white/15"
              >
                {initialsOf(person?.name) || "—"}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-2xl font-medium leading-tight tracking-tight">
                {person?.name || "Unnamed employee"}
              </h2>
              {/* Designation, staff ID and the status tags share one line. */}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <p className="flex items-center gap-1.5 text-xs text-brand-200">
                  <FaBriefcase aria-hidden="true" className="text-[10px]" />
                  <span className="truncate">
                    {employee?.designation || roleLabel(person?.role)}
                  </span>
                  <span aria-hidden="true" className="text-brand-400">
                    /
                  </span>
                  <span className="truncate font-mono text-[11px] text-brand-300">
                    {employee?.employeeId}
                  </span>
                </p>

                {employee?.employmentStatus && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                      STATUS_TONE[employee.employmentStatus] ||
                      "bg-white/10 text-slate-200 ring-white/20"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${
                        STATUS_DOT[employee.employmentStatus] || "bg-slate-400"
                      }`}
                    />
                    {employee.employmentStatus}
                  </span>
                )}

                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-brand-100 ring-1 ring-white/15">
                  Personnel file
                  <span className="inline-block h-1 w-10 overflow-hidden rounded-full bg-white/25">
                    <span
                      className="block h-full rounded-full bg-brand-300"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  <span className="font-mono tabular-nums text-white">
                    {percent}%
                  </span>
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {canManage && onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(employeeId)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                >
                  <FaPen aria-hidden="true" className="text-[10px]" />
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close details"
                autoFocus
                className="rounded-lg p-2 text-brand-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {loading ? (
            <Loader label="Loading employee details…" compact />
          ) : error || !employee ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">
                This record is unavailable
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                {error}
              </p>
            </div>
          ) : (
            <>
              {/* Four columns keeps every group on one screen. */}
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groups.map((group) => {
                  const recorded = group.fields.filter((field) =>
                    Boolean(field.value)
                  );

                  return (
                    <section key={group.title}>
                      <h3 className="border-b border-slate-200 pb-1.5 text-xs font-semibold text-brand-900">
                        {group.title}
                      </h3>

                      {recorded.length === 0 ? (
                        <p className="pt-2 text-xs text-slate-400">
                          Nothing recorded yet.
                        </p>
                      ) : (
                        <dl className="space-y-2.5 pt-2.5">
                          {recorded.map((field) => (
                            <div key={field.label}>
                              <dt className="text-[11px] text-slate-500">
                                {field.label}
                              </dt>
                              <dd
                                className={`text-[13px] leading-5 ${
                                  field.mono
                                    ? "font-mono tabular-nums text-slate-900"
                                    : "font-medium text-slate-900"
                                }`}
                              >
                                {field.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </section>
                  );
                })}

                {missing.length > 0 && canManage && (
                <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 sm:col-span-2 xl:col-span-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-xs font-semibold text-slate-900">
                      Still to record
                    </h3>
                    <span className="font-mono text-[11px] tabular-nums text-slate-500">
                      {missing.length} of {tracked}
                    </span>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {missing.map((entry) => (
                      <li
                        key={`${entry.group}-${entry.label}`}
                        title={entry.group}
                        className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200"
                      >
                        {entry.label}
                      </li>
                    ))}
                  </ul>
                </section>
                )}
              </div>
            </>
          )}
        </div>

        {canManage && (
          <div className="flex shrink-0 flex-wrap items-center gap-5 border-t border-slate-100 px-5 py-2.5 text-[11px] font-semibold sm:px-6">
            <Link
              to={`/admin-dashboard/salary-history/${employeeId}`}
              className="text-brand-700 transition hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Salary history
            </Link>
            <Link
              to={`/admin-dashboard/employee-leaves/${employeeId}`}
              className="text-brand-700 transition hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Leave records
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDetailsModal;
