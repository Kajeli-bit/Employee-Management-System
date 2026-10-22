import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SummaryCard from "./SummaryCard";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { formatCurrency } from "../../utils/format";
import { roleLabel } from "../../utils/roles";

import {
  FaUsers,
  FaBuilding,
  FaMoneyBillWave,
  FaFileAlt,
  FaCheckCircle,
  FaChevronRight,
  FaClock,
} from "react-icons/fa";

const todayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Africa/Dar_es_Salaam",
}).format(new Date());

const greetingHour = Number(
  new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    hour12: false,
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date())
);

const greeting =
  greetingHour < 12
    ? "Good morning"
    : greetingHour < 17
      ? "Good afternoon"
      : "Good evening";

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Africa/Dar_es_Salaam",
});

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  timeZone: "Africa/Dar_es_Salaam",
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Africa/Dar_es_Salaam",
});

const toDayMonthYear = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const parts = value.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const LedgerRow = ({ label, value, dot, onClick, glowColor }) => (
  <button
    type="button"
    onClick={onClick}
    style={glowColor ? { "--alert-glow": glowColor } : undefined}
    className={`flex w-full items-center justify-between gap-4 rounded-lg py-2 text-left first:pt-0 last:pb-0 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-white ${glowColor ? "alert-blink" : ""}`}
  >
    <span className="flex items-center gap-2 text-lg font-medium text-white">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${dot}`}
      />
      {label}
    </span>
    <span className="flex items-center gap-2">
      <span className="font-mono text-lg font-semibold tabular-nums text-white">
        {value}
      </span>
      <FaChevronRight
        aria-hidden="true"
        className="text-xs text-brand-300"
      />
    </span>
  </button>
);

const AdminSummary = () => {
  const { user, getToken } = useAuth();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState({
    totalEmployees: 0,
    totalDepartments: 0,
    totalSalaryRecords: 0,
    totalSalaryPaid: 0,
    totalLeaves: 0,
    approvedLeaves: 0,
    pendingLeaves: 0,
    rejectedLeaves: 0,
    attendance: {
      checkedIn: 0,
      late: 0,
      halfDay: 0,
      notCheckedIn: 0,
    },
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user || !getToken) {
      return;
    }

    let cancelled = false;

    const fetchDashboard = async () => {
      try {
        const token = await getToken();

        if (!token) {
          console.log("CLERK TOKEN NOT FOUND");
          return;
        }

        const response = await axios.get(
          `${API_URL}/api/dashboard`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!cancelled && response.data.success) {
          setDashboard(
            response.data.dashboard || {}
          );
        }
      } catch (fetchError) {
        if (cancelled) {
          return;
        }

        console.log(
          "DASHBOARD ERROR:",
          fetchError.response?.status,
          fetchError.response?.data ||
            fetchError.message
        );

        setError(
          fetchError.response?.data?.error ||
            "Could not load the dashboard. Check your connection and try again."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [user, getToken, retryKey]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded-lg bg-slate-200" />
          <div className="h-40 rounded-2xl bg-slate-200" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            The dashboard did not load
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              setRetryKey((key) => key + 1);
            }}
            className="mt-4 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const checkedIn = dashboard.attendance?.checkedIn ?? 0;
  const attendanceRate =
    dashboard.totalEmployees > 0
      ? Math.min(
          100,
          Math.round(
            (checkedIn / dashboard.totalEmployees) * 100
          )
        )
      : 0;

  const leaveStates = [
    {
      label: "Applied",
      value: dashboard.totalLeaves,
      dot: "bg-brand-400",
      to: "/admin-dashboard/leave",
    },
    {
      label: "Approved",
      value: dashboard.approvedLeaves,
      dot: "bg-emerald-500",
      to: "/admin-dashboard/leave?status=Approved",
    },
    {
      label: "Pending",
      value: dashboard.pendingLeaves,
      dot: "bg-amber-500",
      to: "/admin-dashboard/leave?status=Pending",
    },
    {
      label: "Rejected",
      value: dashboard.rejectedLeaves,
      dot: "bg-rose-500",
      to: "/admin-dashboard/leave?status=Rejected",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {greeting} {roleLabel(user?.role)}
          </h1>
        </div>
        <p className="inline-flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <FaUsers aria-hidden="true" className="text-brand-600" />
          <span className="font-mono text-2xl font-bold tabular-nums tracking-tight text-slate-900">
            {dashboard.totalEmployees}
          </span>
          <span className="text-sm font-medium text-slate-500">
            {dashboard.totalEmployees === 1 ? "person" : "people"} on
            the system
          </span>
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section
          aria-label="Attendance today"
          className="overflow-hidden rounded-2xl bg-brand-950 text-white shadow-sm lg:col-span-2"
        >
          <div
            className="flex h-full flex-col justify-between gap-6 p-5 sm:flex-row sm:items-center sm:p-6"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.13) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          >
            <div className="text-center">
              <p className="flex items-center justify-center gap-2 text-xl font-semibold text-white sm:text-2xl">
                <FaClock aria-hidden="true" />
                Checked in today
              </p>
              <p className="mt-1 font-mono text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl">
                {checkedIn}
              </p>
              <div className="mx-auto mt-3 max-w-[220px]">
                <div
                  role="progressbar"
                  aria-valuenow={attendanceRate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Share of workforce checked in"
                  className="h-1.5 overflow-hidden rounded-full bg-white/15"
                >
                  <div
                    className="h-full rounded-full bg-white transition-[width]"
                    style={{ width: `${attendanceRate}%` }}
                  />
                </div>
                <p className="mt-1.5 text-sm font-semibold text-white">
                  {attendanceRate}% of {dashboard.totalEmployees}{" "}
                  {dashboard.totalEmployees === 1 ? "person" : "people"} ·{" "}
                  {toDayMonthYear(dashboard.attendance?.date) ||
                    todayLabel}
                </p>
              </div>
            </div>
            <dl className="w-full max-w-xs divide-y divide-white/10 border-t border-white/10 sm:w-64 sm:border-l sm:border-t-0 sm:pl-6">
              <div className="py-1">
                <LedgerRow
                  label="Late arrivals"
                  value={dashboard.attendance?.late ?? 0}
                  dot="bg-amber-400"
                  onClick={() =>
                    navigate("/admin-dashboard/attendance?status=Late")
                  }
                  glowColor={
                    (dashboard.attendance?.late ?? 0) > 0
                      ? "rgba(251,191,36,0.8)"
                      : null
                  }
                />
              </div>
              <div className="py-1">
                <LedgerRow
                  label="Half days"
                  value={dashboard.attendance?.halfDay ?? 0}
                  dot="bg-sky-400"
                  onClick={() =>
                    navigate("/admin-dashboard/attendance?status=Half%20Day")
                  }
                  glowColor={
                    (dashboard.attendance?.halfDay ?? 0) > 0
                      ? "rgba(56,189,248,0.75)"
                      : null
                  }
                />
              </div>
              <div className="py-1">
                <LedgerRow
                  label="Not checked in"
                  value={dashboard.attendance?.notCheckedIn ?? 0}
                  dot="bg-rose-400"
                  onClick={() =>
                    navigate("/admin-dashboard/attendance?status=Missing")
                  }
                  glowColor={
                    (dashboard.attendance?.notCheckedIn ?? 0) > 0
                      ? "rgba(251,113,133,0.75)"
                      : null
                  }
                />
              </div>
            </dl>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse"
              />
              Current time
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-2xl">
              {timeFormatter.format(now)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              East Africa Time
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Today</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {dayFormatter.format(now)}
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-slate-400 sm:text-sm">
              {dateFormatter.format(now)}
            </p>
          </div>
        </div>
      </div>

      <section aria-label="Workforce" className="mt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={<FaUsers />}
            text="People on the system"
            number={dashboard.totalEmployees}
            tone="brand"
            to="/admin-dashboard/employees"
          />
          <SummaryCard
            icon={<FaBuilding />}
            text="Departments"
            number={dashboard.totalDepartments}
            tone="brand"
            to="/admin-dashboard/departments"
          />
          <SummaryCard
            icon={<FaMoneyBillWave />}
            text="Salary records"
            number={dashboard.totalSalaryRecords}
            tone="brand"
            to="/admin-dashboard/salary"
          />
          <SummaryCard
            icon={<FaMoneyBillWave />}
            text="Total salary paid"
            number={formatCurrency(dashboard.totalSalaryPaid)}
            tone="emerald"
            to="/admin-dashboard/salary"
          />
        </div>
      </section>

      <section
        aria-label="Leave statistics"
        className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <FaFileAlt aria-hidden="true" className="text-brand-600" />
            Leave applications
          </h2>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-100 lg:grid-cols-4">
          {leaveStates.map((state) => (
            <button
              key={state.label}
              type="button"
              onClick={() => navigate(state.to)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${state.dot}`}
              />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xl font-semibold tabular-nums text-slate-900">
                  {state.value}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {state.label}
                </p>
              </div>
              <FaChevronRight
                aria-hidden="true"
                className="text-xs text-slate-300"
              />
            </button>
          ))}
        </div>
      </section>

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <FaCheckCircle aria-hidden="true" className="text-emerald-500" />
        Figures update as people clock in and managers approve.
      </p>
    </div>
  );
};

export default AdminSummary;
