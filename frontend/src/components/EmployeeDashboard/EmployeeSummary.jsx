import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaClock,
  FaMoneyBillWave,
  FaSitemap,
  FaUser,
} from "react-icons/fa";

import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import {
  attendanceTone,
  formatClock,
  formatWeekdayDate,
} from "../../utils/format";
import { roleLabel } from "../../utils/roles";

const links = [
  {
    to: "/employee-dashboard/attendance",
    label: "Clock in or out",
    detail: "GPS attendance",
    icon: FaClock,
  },
  {
    to: "/employee-dashboard/apply-leave",
    label: "Apply for leave",
    detail: "Casual, sick, annual, emergency",
    icon: FaCalendarAlt,
  },
  {
    to: "/employee-dashboard/salary",
    label: "My salary",
    detail: "Payslips and history",
    icon: FaMoneyBillWave,
  },
  {
    to: "/employee-dashboard/profile",
    label: "My profile",
    detail: "Contact and employment record",
    icon: FaUser,
  },
];

const EmployeeSummary = () => {
  const { user, getToken } = useAuth();

  const [today, setToday] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();

        const response = await axios.get(`${API_URL}/api/attendance/today`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data.success) {
          setToday(response.data);
        }
      } catch (error) {
        console.log("TODAY ATTENDANCE ERROR:", error.message);
      }
    };

    if (getToken) {
      load();
    }
  }, [getToken]);

  const record = today?.record;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-slate-500">{formatWeekdayDate(new Date())}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
        Karibu, {user?.name?.split(" ")[0] || "team"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {roleLabel(user?.role)}
        {user?.designation ? ` · ${user.designation}` : ""}
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Today
            </p>

            {record?.checkIn ? (
              <>
                <p className="mt-1 flex items-center gap-2 font-mono text-2xl font-semibold text-slate-900">
                  {formatClock(record.checkIn.at)}
                  <span
                    className={`rounded border px-2 py-0.5 font-sans text-[11px] font-semibold ${attendanceTone(
                      record.status
                    )}`}
                  >
                    {record.status}
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {record.checkIn.locationName || "Field check-in"}
                  {record.checkOut?.at
                    ? ` · clocked out ${formatClock(record.checkOut.at)}`
                    : " · still on the clock"}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  Not clocked in
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Shift starts at {today?.policy?.workStart || "08:00"}.
                </p>
              </>
            )}
          </div>

          <Link
            to="/employee-dashboard/attendance"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            Open attendance
            <FaArrowRight className="text-xs" />
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {links.map((link) => {
          const Icon = link.icon;

          return (
            <Link
              key={link.to}
              to={link.to}
              className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-300"
            >
              <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900 group-hover:text-brand-800">
                  {link.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {link.detail}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        to="/employee-dashboard/organisation"
        className="mt-6 flex items-center justify-between rounded-2xl border border-slate-900 bg-slate-900 px-5 py-4 text-white transition hover:bg-slate-800"
      >
        <span>
          <span className="block text-sm font-semibold">
            See where you sit in Nilric
          </span>
          <span className="mt-0.5 block text-xs text-slate-300">
            Managing Director to project teams, on one page
          </span>
        </span>
        <FaSitemap className="text-lg text-brand-400" />
      </Link>
    </div>
  );
};

export default EmployeeSummary;
