import { useEffect, useState } from "react";
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
  FaHourglassHalf,
  FaTimesCircle,
  FaClock,
  FaMapMarkerAlt,
  FaTachometerAlt,
} from "react-icons/fa";

const AdminSummary = () => {
  const { user, getToken } = useAuth();

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

  const getRoleName = () => `${roleLabel(user?.role)} dashboard`;

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

      if (response.data.success) {
        setDashboard(
          response.data.dashboard || {}
        );
      }
    } catch (error) {
      console.log(
        "DASHBOARD ERROR:",
        error.response?.status,
        error.response?.data ||
          error.message
      );

      alert(
        error.response?.data?.error ||
          "Failed to load dashboard"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && getToken) {
      fetchDashboard();
    }
  }, [user, getToken]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-slate-900">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-700 text-xl text-white shadow-sm">
              <FaTachometerAlt aria-hidden="true" />
            </span>
            {getRoleName()}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Nilric workforce at a glance ·{" "}
            {dashboard.totalEmployees}{" "}
            {dashboard.totalEmployees === 1 ? "person" : "people"} on the
            system
          </p>
        </div>

        <div className="flex gap-3 text-right">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Salary paid
            </p>
            <p className="font-mono text-xl font-semibold tabular-nums text-slate-900">
              {formatCurrency(dashboard.totalSalaryPaid)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Pending leave
            </p>
            <p className="font-mono text-xl font-semibold tabular-nums text-slate-900">
              {dashboard.pendingLeaves}
            </p>
          </div>
        </div>
      </div>

      <section className="mt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Workforce</h2>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={<FaUsers />}
            text="Total Employees"
            number={dashboard.totalEmployees}
            color="bg-blue-600"
          />

          <SummaryCard
            icon={<FaBuilding />}
            text="Departments"
            number={dashboard.totalDepartments}
            color="bg-green-600"
          />

          <SummaryCard
            icon={<FaMoneyBillWave />}
            text="Salary Records"
            number={dashboard.totalSalaryRecords}
            color="bg-purple-600"
          />

          <SummaryCard
            icon={<FaMoneyBillWave />}
            text="Total Salary Paid"
            number={formatCurrency(dashboard.totalSalaryPaid)}
            color="bg-red-600"
          />
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              Attendance today
            </h2>
            <span className="font-mono text-xs text-slate-500">
              {dashboard.attendance?.date || ""}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Who has checked in so far today.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={<FaClock />}
            text="Checked in"
            number={dashboard.attendance?.checkedIn ?? 0}
            color="bg-brand-600"
          />

          <SummaryCard
            icon={<FaHourglassHalf />}
            text="Late arrivals"
            number={dashboard.attendance?.late ?? 0}
            color="bg-amber-500"
          />

          <SummaryCard
            icon={<FaMapMarkerAlt />}
            text="Half days"
            number={dashboard.attendance?.halfDay ?? 0}
            color="bg-sky-600"
          />

          <SummaryCard
            icon={<FaUsers />}
            text="Not checked in"
            number={dashboard.attendance?.notCheckedIn ?? 0}
            color="bg-gray-700"
          />
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Leave statistics
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Applications by current approval state.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={<FaFileAlt />}
            text="Leave Applied"
            number={dashboard.totalLeaves}
            color="bg-indigo-600"
          />

          <SummaryCard
            icon={<FaCheckCircle />}
            text="Approved"
            number={dashboard.approvedLeaves}
            color="bg-green-600"
          />

          <SummaryCard
            icon={<FaHourglassHalf />}
            text="Pending"
            number={dashboard.pendingLeaves}
            color="bg-yellow-500"
          />

          <SummaryCard
            icon={<FaTimesCircle />}
            text="Rejected"
            number={dashboard.rejectedLeaves}
            color="bg-red-600"
          />
        </div>
      </section>
    </div>
  );
};

export default AdminSummary;