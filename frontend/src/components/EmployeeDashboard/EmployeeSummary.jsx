import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaSitemap,
} from "react-icons/fa";

import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import {
  TIME_ZONE,
  attendanceTone,
  formatClock,
  formatDate,
  formatDuration,
  formatWeekdayDate,
  todayKey as todayDateKey,
} from "../../utils/format";
import { roleLabel } from "../../utils/roles";
import { useWorkspace } from "../../utils/workspace";

const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
});

const minutesFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
});

const timeToMinutes = (value) => {
  const [hours, minutes] = String(value || "").split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const minutesOfDay = (date) => {
  const [hours, minutes] = minutesFormatter.format(date).split(":").map(Number);
  return hours * 60 + minutes;
};

const formatMinutes = (total) => {
  if (!Number.isFinite(total)) {
    return "";
  }

  const hours = Math.floor(total / 60) % 24;
  return `${String(hours).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const EmployeeSummary = () => {
  const { user, getToken } = useAuth();
  const workspace = useWorkspace();

  const [today, setToday] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!getToken) {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const token = await getToken();
        const config = { headers: { Authorization: `Bearer ${token}` } };

        // One failing panel should not blank the whole dashboard.
        const [todayResult, leavesResult] = await Promise.allSettled([
          axios.get(`${API_URL}/api/attendance/today`, config),
          axios.get(`${API_URL}/api/leave/my-leave`, config),
        ]);

        if (cancelled) {
          return;
        }

        if (
          todayResult.status === "fulfilled" &&
          todayResult.value.data.success
        ) {
          setToday(todayResult.value.data);
        }

        if (
          leavesResult.status === "fulfilled" &&
          leavesResult.value.data.success
        ) {
          setLeaves(leavesResult.value.data.leaves || []);
        }

        if (
          todayResult.status === "rejected" &&
          leavesResult.status === "rejected"
        ) {
          setError("We could not load your dashboard. Refresh to try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const record = today?.record;
  const policy = today?.policy;

  const workStart = policy?.workStart || "08:00";
  const workEnd = policy?.workEnd || "17:00";
  const shiftStart = timeToMinutes(workStart) ?? 8 * 60;
  const shiftEnd = timeToMinutes(workEnd) ?? 17 * 60;
  const graceEnd = shiftStart + Number(policy?.graceMinutes || 0);

  const onTheClock = Boolean(record?.checkIn) && !record?.checkOut;
  const finished = Boolean(record?.checkOut);

  const workedMinutes = finished
    ? record?.workedMinutes || 0
    : onTheClock
      ? Math.max(
          0,
          Math.floor((now.getTime() - new Date(record.checkIn.at).getTime()) / 60000)
        )
      : 0;

  // The rail marks the moment the day reached: now, or the clock-out time.
  const markerMinutes = finished
    ? minutesOfDay(new Date(record.checkOut.at))
    : minutesOfDay(now);
  const progress = Math.min(
    100,
    Math.max(0, ((markerMinutes - shiftStart) / Math.max(1, shiftEnd - shiftStart)) * 100)
  );

  const todayStamp = todayDateKey();
  const pendingLeaves = leaves.filter((leave) => leave.status === "Pending");
  const approvedLeaves = leaves.filter((leave) => leave.status === "Approved");
  const nextLeave = approvedLeaves
    .filter((leave) => String(leave.fromDate).slice(0, 10) >= todayStamp)
    .sort((a, b) => new Date(a.fromDate) - new Date(b.fromDate))[0];

  const role = roleLabel(user?.role);
  const designation = (user?.designation || "").trim();
  const department = today?.employee?.department || "";
  const roleLine = [
    department,
    designation && designation.toLowerCase() !== role.toLowerCase()
      ? designation
      : role,
  ]
    .filter(Boolean)
    .join(" · ");

  const headline = useMemo(() => {
    if (loading) {
      return "Checking today's attendance";
    }

    if (finished) {
      return "Day recorded";
    }

    return onTheClock ? "On the clock" : "Not clocked in";
  }, [loading, finished, onTheClock]);

  const detail = useMemo(() => {
    if (loading) {
      return "One moment while we load your shift.";
    }

    if (finished) {
      return `In at ${formatClock(record.checkIn.at)}, out at ${formatClock(
        record.checkOut.at
      )} — ${formatDuration(workedMinutes)} recorded.`;
    }

    if (onTheClock) {
      return `In at ${formatClock(record.checkIn.at)} — ${formatDuration(
        workedMinutes
      )} so far.`;
    }

    return policy?.graceMinutes
      ? `Shift starts at ${workStart}. Late after ${formatMinutes(graceEnd)}.`
      : `Shift starts at ${workStart}.`;
  }, [loading, finished, onTheClock, record, workedMinutes, policy, workStart, graceEnd]);

  const leaveLine = nextLeave
    ? `${nextLeave.leaveType}, ${formatDate(nextLeave.fromDate)} to ${formatDate(
        nextLeave.toDate
      )}.`
    : "No approved leave ahead.";

  const firstName = user?.name?.split(" ")[0] || "team";
  const locationName = record?.checkIn?.locationName || "Field check-in";

  return (
    <div
      className={`mx-auto max-w-5xl ${
        workspace.inAdmin ? "px-4 pb-12 pt-10 sm:px-6" : ""
      }`}
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{formatWeekdayDate(now)}</p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-brand-950">
            Karibu, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">{roleLine}</p>
        </div>

        <p
          aria-label={`${clockFormatter.format(now)} East Africa Time`}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
          />
          <span className="font-mono text-sm font-semibold tabular-nums text-slate-800">
            {clockFormatter.format(now)}
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            East Africa Time
          </span>
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.45fr_1fr] lg:items-start">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Today
              </p>
              <p className="mt-1.5 font-display text-2xl font-medium leading-snug tracking-tight text-brand-950">
                {headline}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
            </div>

            {record?.status && (
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${attendanceTone(
                  record.status
                )}`}
              >
                {record.status}
              </span>
            )}
          </div>

          <div className="mt-7">
            <div className="flex items-baseline justify-between gap-3 text-xs text-slate-500">
              <span>
                Shift {workStart} to {workEnd}
              </span>
              <span className="font-mono tabular-nums text-slate-400">
                {loading
                  ? ""
                  : finished
                    ? `Out ${formatClock(record.checkOut.at)}`
                    : onTheClock
                      ? `${formatDuration(workedMinutes)} on the clock`
                      : `Now ${formatMinutes(markerMinutes)}`}
              </span>
            </div>

            <div
              role="presentation"
              className="relative mt-2 h-1.5 rounded-full bg-slate-100"
            >
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${
                  finished
                    ? "bg-emerald-500"
                    : onTheClock
                      ? "bg-brand-600"
                      : "bg-slate-300"
                }`}
                style={{ width: `${loading ? 0 : progress}%` }}
              />
              {!loading && (
                <span
                  aria-hidden="true"
                  className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm ${
                    finished
                      ? "bg-emerald-600"
                      : onTheClock
                        ? "bg-brand-700"
                        : "bg-slate-400"
                  }`}
                  style={{ left: `${progress}%` }}
                />
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              {record?.checkIn
                ? `Checked in at ${locationName}.`
                : "Check in from any Nilric site with GPS."}
            </p>

            <Link
              to={workspace.attendance}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Open attendance
              <FaArrowRight aria-hidden="true" className="text-[11px]" />
            </Link>
          </div>
        </section>

        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Leave</h2>
              <Link
                to={workspace.leaves}
                className="text-xs font-semibold text-brand-700 transition hover:text-brand-900"
              >
                My leaves
              </Link>
            </div>

            <div className="mt-4 flex items-end gap-7">
              <div>
                <p className="font-mono text-3xl font-semibold leading-none tabular-nums text-slate-900">
                  {loading ? "—" : pendingLeaves.length}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">Pending</p>
              </div>

              <div>
                <p className="font-mono text-3xl font-semibold leading-none tabular-nums text-slate-900">
                  {loading ? "—" : approvedLeaves.length}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">Approved</p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              {loading ? "Loading your requests…" : leaveLine}
            </p>

            <Link
              to={workspace.applyLeave}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 transition hover:border-brand-300 hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <FaCalendarAlt aria-hidden="true" className="text-xs" />
              Apply for leave
            </Link>
          </section>

          <Link
            to={workspace.organisation}
            className="group flex items-center justify-between gap-4 rounded-2xl bg-brand-950 px-5 py-4 text-white shadow-sm transition hover:bg-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                See where you sit in Nilric
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-brand-200">
                The whole company, from the Managing Director down.
              </span>
            </span>
            <FaSitemap
              aria-hidden="true"
              className="shrink-0 text-lg text-brand-300 transition group-hover:text-white"
            />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EmployeeSummary;
