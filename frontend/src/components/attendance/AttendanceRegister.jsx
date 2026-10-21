import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FaChevronLeft, FaChevronRight, FaPen } from "react-icons/fa";

import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { CAPABILITIES, hasCapability } from "../../utils/roles";
import {
  attendanceTone,
  formatClock,
  formatDistance,
  formatDuration,
  formatWeekdayDate,
  todayKey,
} from "../../utils/format";

const STATUSES = ["Present", "Late", "Half Day", "Absent", "On Leave"];

const Stat = ({ label, value, tone = "text-slate-900" }) => (
  <div className="px-5 py-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${tone}`}>
      {value}
    </p>
  </div>
);

const AttendanceRegister = () => {
  const { user, getToken } = useAuth();

  const [date, setDate] = useState(todayKey());
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [departments, setDepartments] = useState([]);

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [policy, setPolicy] = useState(null);
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

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
        setPolicy(response.data.policy);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      setError(
        error.response?.data?.error || "Unable to load attendance records."
      );
    } finally {
      setLoading(false);
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

  const moveDate = (days) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);
    setDate(next.toISOString().slice(0, 10));
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Attendance register
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatWeekdayDate(`${date}T09:00:00+03:00`)}
            {policy?.requireGeofence
              ? " · GPS check-in required"
              : " · GPS not enforced"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => moveDate(-1)}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-brand-300 hover:text-brand-700"
            aria-label="Previous day"
          >
            <FaChevronLeft className="text-xs" />
          </button>

          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />

          <button
            type="button"
            onClick={() => moveDate(1)}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-brand-300 hover:text-brand-700"
            aria-label="Next day"
          >
            <FaChevronRight className="text-xs" />
          </button>
        </div>
      </div>

      {summary && (
        <div className="mt-5 grid grid-cols-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-y-0 sm:divide-x lg:grid-cols-5">
          <Stat label="On the roster" value={summary.roster} />
          <Stat label="Checked in" value={summary.checkedIn} />
          <Stat label="Late" value={summary.late} tone="text-amber-700" />
          <Stat label="Half day" value={summary.halfDay} tone="text-sky-700" />
          <Stat
            label="Not checked in"
            value={summary.notCheckedIn}
            tone="text-rose-700"
          />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select
          value={department}
          onChange={(event) => {
            setDepartment(event.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500"
        >
          <option value="">All departments</option>
          {departments.map((entry) => (
            <option key={entry._id} value={entry._id}>
              {entry.kind === "team" ? `— ${entry.dep_name}` : entry.dep_name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500"
        >
          <option value="">Any status</option>
          {STATUSES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>

        <span className="ml-auto text-xs text-slate-400">
          {pagination?.total || 0} employees
        </span>
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
                <th className="px-5 py-2.5 font-semibold">Employee</th>
                <th className="px-3 py-2.5 font-semibold">Department</th>
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
                    Loading register…
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
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.designation || row.role}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {row.department}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {formatClock(row.record?.checkIn?.at)}
                    </td>
                    <td className="px-3 py-3 font-mono">
                      {formatClock(row.record?.checkOut?.at)}
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
