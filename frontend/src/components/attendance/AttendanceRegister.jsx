import { useCallback, useEffect, useRef, useState } from "react";
import Loader from "../common/Loader";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  FaCheck,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaPen,
} from "react-icons/fa";

import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { CAPABILITIES, hasCapability } from "../../utils/roles";
import {
  attendanceTone,
  formatClock,
  formatDistance,
  formatDuration,
  todayKey,
} from "../../utils/format";

const STATUSES = ["Present", "Late", "Half Day", "Absent", "On Leave"];

const Stat = ({
  label,
  value,
  tone = "text-slate-900",
  active = false,
  onClick,
}) => {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={`px-5 py-2.5 text-left ${
        onClick
          ? `transition hover:bg-slate-50 ${
              active ? "bg-brand-50 ring-1 ring-inset ring-brand-300" : ""
            }`
          : ""
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl leading-none font-semibold tabular-nums ${tone}`}>
        {value}
      </p>
    </Tag>
  );
};

const DepartmentMenu = ({ value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const items = [
    { id: "", label: "All departments" },
    ...options
      .filter((entry) => entry.kind !== "team")
      .map((entry) => ({
        id: entry._id,
        label: entry.dep_name,
      })),
  ];
  const selected = items.find((item) => item.id === value) || items[0];

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const choose = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative mt-1">
      <button
        type="button"
        id="attendance-department"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 bg-transparent text-left text-sm font-semibold text-slate-900 outline-none transition hover:text-brand-700"
      >
        <span className="truncate">{selected.label}</span>
        <FaChevronDown
          className={`shrink-0 text-[10px] text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-[-40px] top-full z-30 mt-2 max-h-72 w-max min-w-[16rem] max-w-xs overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          {items.map((item) => {
            const isSelected = item.id === selected.id;

            return (
              <li key={item.id || "all"} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(item.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition ${
                    isSelected
                      ? "bg-brand-50 font-semibold text-brand-800"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="whitespace-nowrap">{item.label}</span>
                  {isSelected && (
                    <FaCheck className="shrink-0 text-[10px] text-brand-700" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const AttendanceRegister = () => {
  const { user, getToken } = useAuth();

  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(todayKey());
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState(() => {
    const initial = searchParams.get("status") || "";
    return initial === "Missing" ||
      initial === "CheckedIn" ||
      STATUSES.includes(initial)
      ? initial
      : "";
  });
  const [departments, setDepartments] = useState([]);

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    checkInTime: "",
    checkOutTime: "",
    status: "Present",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  const canRegularize = hasCapability(
    user?.role,
    CAPABILITIES.ATTENDANCE_MANAGE
  );

  const fetchDepartments = useCallback(async () => {
    try {
      const token = await getToken();

      const response = await axios.get(`${API_URL}/api/department`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setDepartments(response.data.departments || []);
      }
    } catch (error) {
      console.log("DEPARTMENT LOAD ERROR:", error.message);
    }
  }, [getToken]);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError("");
      }

      const token = await getToken();

      if (!token) {
        return;
      }

      const response = await axios.get(`${API_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          date,
          page,
          limit: 25,
          ...(department && { department }),
          ...(status && { status }),
        },
      });

      if (response.data.success) {
        setRows(response.data.rows || []);
        setSummary(response.data.summary);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      setError(
        error.response?.data?.error || "Unable to load attendance records."
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [date, department, status, page, getToken]);

  useEffect(() => {
    if (getToken) {
      fetchDepartments();
    }
  }, [fetchDepartments, getToken]);

  useEffect(() => {
    if (getToken) {
      load();
    }
  }, [getToken, load]);

  // Keep the management register in sync when the scheduled server sweep
  // closes an employee's open record while this tab is still mounted.
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        load({ silent: true });
      }
    };

    const onAttendanceRefresh = () => load({ silent: true });
    const interval = setInterval(refreshIfVisible, 60 * 1000);

    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("ems:attendance-refresh", onAttendanceRefresh);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("ems:attendance-refresh", onAttendanceRefresh);
    };
  }, [load]);

  const openRegularize = (row) => {
    setEditing(row);
    setForm({
      checkInTime: row.record?.checkIn?.at
        ? formatClock(row.record.checkIn.at)
        : "",
      checkOutTime: row.record?.checkOut?.at
        ? formatClock(row.record.checkOut.at)
        : "",
      status: row.record?.status || "Present",
      note: row.record?.note || "",
    });
  };

  const saveRegularization = async (event) => {
    event.preventDefault();

    if (!editing) {
      return;
    }

    try {
      setSaving(true);

      const token = await getToken();

      const response = await axios.post(
        `${API_URL}/api/attendance/mark`,
        {
          employeeId: editing.employeeId,
          date,
          checkInTime: form.checkInTime,
          checkOutTime: form.checkOutTime,
          status: form.status,
          note: form.note,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setEditing(null);
        await load();
      }
    } catch (error) {
      alert(
        error.response?.data?.error || "Unable to regularize attendance."
      );
    } finally {
      setSaving(false);
    }
  };

  const selectStatus = (value) => {
    setStatus(value);
    setPage(1);
  };

  const dateInputRef = useRef(null);
  const today = todayKey();
  const isToday = date >= today;
  const daysAgo = Math.round(
    (new Date(`${today}T12:00:00`) - new Date(`${date}T12:00:00`)) / 86400000
  );
  const dateCaption =
    daysAgo <= 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`;
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };

  const moveDate = (days) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);
    const key = [
      next.getFullYear(),
      String(next.getMonth() + 1).padStart(2, "0"),
      String(next.getDate()).padStart(2, "0"),
    ].join("-");
    if (key > today) return;
    setDate(key);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-brand-950 sm:text-5xl">
            Attendance register
          </h1>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-y-0 sm:divide-x lg:grid-cols-[210px_repeat(5,minmax(0,1fr))_minmax(260px,1.5fr)]">
          <div className="px-5 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Department
            </p>
            <DepartmentMenu
              value={department}
              options={departments}
              onChange={(id) => {
                setDepartment(id);
                setPage(1);
              }}
            />
          </div>
          <Stat
            label="On the roster"
            value={summary?.roster ?? "—"}
            active={status === ""}
            onClick={() => selectStatus("")}
          />
          <Stat
            label="Checked in"
            value={summary?.checkedIn ?? "—"}
            active={status === "CheckedIn"}
            onClick={() => selectStatus("CheckedIn")}
          />
          <Stat
            label="Late"
            value={summary?.late ?? "—"}
            tone="text-amber-700"
            active={status === "Late"}
            onClick={() => selectStatus("Late")}
          />
          <Stat
            label="Half day"
            value={summary?.halfDay ?? "—"}
            tone="text-sky-700"
            active={status === "Half Day"}
            onClick={() => selectStatus("Half Day")}
          />
          <Stat
            label="Not checked in"
            value={summary?.notCheckedIn ?? "—"}
            tone="text-rose-700"
            active={status === "Missing"}
            onClick={() => selectStatus("Missing")}
          />

          <div className="col-span-2 flex min-w-0 flex-col justify-center bg-slate-50/60 px-4 py-2 sm:col-span-3 lg:col-span-1">
            <div className="flex min-w-0 items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
              <button
                type="button"
                onClick={() => moveDate(-1)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-brand-700 active:scale-95"
                aria-label="Previous day"
              >
                <FaChevronLeft className="text-sm" />
              </button>
              <button
                type="button"
                onClick={openDatePicker}
                title="Pick a date"
                className="group flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg px-3 py-0 transition hover:bg-brand-50"
                aria-label={`Choose attendance date, currently ${dateLabel}`}
              >
                <span className="whitespace-nowrap text-base font-semibold leading-tight tracking-tight tabular-nums text-slate-900 transition group-hover:text-brand-800">
                  {dateLabel}
                </span>
                <span
                  className={`whitespace-nowrap text-[11px] leading-tight tabular-nums ${
                    isToday ? "font-medium text-brand-700" : "text-slate-500"
                  }`}
                >
                  {dateCaption}
                </span>
              </button>
              <input
                ref={dateInputRef}
                id="attendance-date"
                type="date"
                tabIndex={-1}
                aria-hidden="true"
                value={date}
                max={today}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value || value > today) return;
                  setDate(value);
                  setPage(1);
                }}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => moveDate(1)}
                disabled={isToday}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-brand-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:active:scale-100"
                aria-label="Next day"
              >
                <FaChevronRight className="text-sm" />
              </button>
            </div>
          </div>
        </div>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Department</th>
                <th className="px-3 py-2.5 font-semibold">Employee</th>
                <th className="px-3 py-2.5 font-semibold">In</th>
                <th className="px-3 py-2.5 font-semibold">Out</th>
                <th className="px-3 py-2.5 font-semibold">Worked</th>
                <th className="px-3 py-2.5 font-semibold">Site</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                {canRegularize && (
                  <th className="px-5 py-2.5 text-right font-semibold">
                    Correct
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={canRegularize ? 8 : 7}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    <Loader label="Loading register…" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canRegularize ? 8 : 7}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    No employees match this filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.employeeId} className="text-slate-700">
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {row.department}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.designation || row.role}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {formatClock(row.record?.checkIn?.at)}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {formatClock(row.record?.checkOut?.at)}
                      {row.record?.checkOut?.automatic && (
                        <span
                          title={row.record.checkOut.reason}
                          className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-wide text-slate-500"
                        >
                          auto
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {row.record?.workedMinutes
                        ? formatDuration(row.record.workedMinutes)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      <p>{row.record?.checkIn?.locationName || "—"}</p>
                      {row.record?.checkIn?.distanceMeters !== undefined && (
                        <p className="text-slate-400">
                          {formatDistance(row.record.checkIn.distanceMeters)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${attendanceTone(
                          row.record?.status || "Absent"
                        )}`}
                      >
                        {row.record?.status || "No record"}
                      </span>
                    </td>
                    {canRegularize && (
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openRegularize(row)}
                          className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                        >
                          <FaPen className="text-[9px]" />
                          Fix
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination?.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={saveRegularization}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Regularize attendance
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {editing.name} · {date}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Clock in
                </span>
                <input
                  type="time"
                  value={form.checkInTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      checkInTime: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">
                  Clock out
                </span>
                <input
                  type="time"
                  value={form.checkOutTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      checkOutTime: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500"
                />
              </label>
            </div>

            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                Status
              </span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                {STATUSES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                Reason for correction
              </span>
              <textarea
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                placeholder="Forgot to clock out, field visit approved by supervisor…"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:bg-slate-300"
              >
                {saving ? "Saving…" : "Save record"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AttendanceRegister;
