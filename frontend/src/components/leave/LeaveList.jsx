import { useEffect, useState } from "react";
import { FaCalendarAlt } from "react-icons/fa";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import Loader from "../common/Loader";
import { canManageRole, isManagementRole } from "../../utils/roles";

const FilterTile = ({ label, value, tone = "text-slate-900", active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`px-5 py-2.5 text-left transition hover:bg-slate-50 ${
      active ? "bg-brand-50 ring-1 ring-inset ring-brand-300" : ""
    }`}
  >
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className={`mt-1 font-mono text-2xl leading-none font-semibold tabular-nums ${tone}`}>
      {value}
    </p>
  </button>
);

const LeaveList = () => {
  const { user, getToken } = useAuth();

  const [leaves, setLeaves] = useState([]);
  const [search, setSearch] = useState("");
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => {
    const initial = searchParams.get("status") || "";
    return ["Pending", "Approved", "Rejected"].includes(initial) ? initial : "";
  });
  const [loading, setLoading] = useState(true);

  const fetchLeaves = async () => {
    try {
      setLoading(true);

      const token = await getToken();

      if (!token) {
        console.log("CLERK TOKEN NOT FOUND");
        return;
      }

      const response = await axios.get(
        `${API_URL}/api/leave`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setLeaves(response.data.leaves || []);
      }
    } catch (error) {
      console.log(
        "GET LEAVES ERROR:",
        error.response?.status,
        error.response?.data || error.message
      );

      alert(
        error.response?.data?.error ||
          "Unable to fetch leave requests"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && getToken) {
      fetchLeaves();
    }
  }, [user, getToken]);

  const updateStatus = async (id, status) => {
    try {
      const token = await getToken();

      if (!token) {
        alert(
          "Authentication token not found. Please login again."
        );
        return;
      }

      const response = await axios.put(
        `${API_URL}/api/leave/${id}/status`,
        { status },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        await fetchLeaves();
      }
    } catch (error) {
      console.log(
        "UPDATE LEAVE STATUS ERROR:",
        error.response?.status,
        error.response?.data || error.message
      );

      alert(
        error.response?.data?.error ||
          "Unable to update leave status"
      );
    }
  };

  const getStatusStyle = (status) => {
    if (status === "Approved") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (status === "Rejected") {
      return "border-rose-200 bg-rose-50 text-rose-700";
    }

    return "border-amber-200 bg-amber-50 text-amber-800";
  };

  const canManageLeave = (leave) => {
    if (!user || !leave) {
      return false;
    }

    if (!isManagementRole(user.role)) {
      return false;
    }

    if (!leave.employeeRole) {
      return false;
    }

    return canManageRole(
      user.role,
      leave.employeeRole
    );
  };

  const pendingCount = leaves.filter(
    (leave) => leave.status === "Pending"
  ).length;
  const approvedCount = leaves.filter(
    (leave) => leave.status === "Approved"
  ).length;
  const rejectedCount = leaves.filter(
    (leave) => leave.status === "Rejected"
  ).length;

  const filteredLeaves = leaves.filter((leave) => {
    if (
      statusFilter &&
      leave.status !== statusFilter
    ) {
      return false;
    }

    const searchText = search.toLowerCase().trim();

    if (!searchText) {
      return true;
    }

    return (
      leave.employeeName
        ?.toLowerCase()
        .includes(searchText) ||
      leave.employeeCode
        ?.toLowerCase()
        .includes(searchText) ||
      leave.employeeRole
        ?.toLowerCase()
        .includes(searchText) ||
      leave.department
        ?.toLowerCase()
        .includes(searchText) ||
      leave.leaveType
        ?.toLowerCase()
        .includes(searchText) ||
      leave.status
        ?.toLowerCase()
        .includes(searchText)
    );
  });

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
  };

  const selectStatus = (value) => {
    setStatusFilter(value);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Loader label="Loading leave requests…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-slate-900">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-700 text-xl text-white shadow-sm">
            <FaCalendarAlt aria-hidden="true" />
          </span>
          Leave Management
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and manage employee leave requests ·{" "}
          {leaves.length}{" "}
          {leaves.length === 1 ? "request" : "requests"} on the
          system
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-y-0 sm:divide-x lg:grid-cols-[calc(20%+110px)_repeat(4,minmax(0,1fr))]">
        <div className="px-5 py-3">
          <label
            htmlFor="leave-search"
            className="block text-[11px] font-medium uppercase tracking-wide text-slate-400"
          >
            Search
          </label>
          <input
            id="leave-search"
            type="text"
            placeholder="Employee, role, department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ outline: "none" }}
            className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
          />
        </div>
        <FilterTile
          label="All requests"
          value={leaves.length}
          active={statusFilter === ""}
          onClick={() => selectStatus("")}
        />
        <FilterTile
          label="Pending"
          value={pendingCount}
          tone="text-amber-700"
          active={statusFilter === "Pending"}
          onClick={() => selectStatus("Pending")}
        />
        <FilterTile
          label="Approved"
          value={approvedCount}
          tone="text-emerald-700"
          active={statusFilter === "Approved"}
          onClick={() => selectStatus("Approved")}
        />
        <FilterTile
          label="Rejected"
          value={rejectedCount}
          tone="text-rose-700"
          active={statusFilter === "Rejected"}
          onClick={() => selectStatus("Rejected")}
        />
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              Leave requests
            </h2>
            <span className="font-mono text-xs text-slate-500">
              {filteredLeaves.length} of {leaves.length} shown
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Approve or reject pending requests you manage.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-brand-50/60 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">No.</th>
                <th className="px-3 py-2 font-semibold">Employee</th>
                <th className="px-3 py-2 font-semibold">Department</th>
                <th className="px-3 py-2 font-semibold">Leave type</th>
                <th className="px-3 py-2 font-semibold">Period</th>
                <th className="px-3 py-2 text-right font-semibold">
                  Days
                </th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeaves.length > 0 ? (
                filteredLeaves.map((leave, index) => {
                  const canApproveReject =
                    leave.status === "Pending" &&
                    canManageLeave(leave);

                  const from = leave.fromDate
                    ? new Date(
                        leave.fromDate
                      ).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "N/A";
                  const to = leave.toDate
                    ? new Date(
                        leave.toDate
                      ).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "N/A";

                  return (
                    <tr
                      key={leave._id}
                      className="transition hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-2 font-mono text-xs tabular-nums text-slate-400">
                        {String(index + 1).padStart(2, "0")}
                      </td>
                      <td className="max-w-[220px] px-3 py-2">
                        <p
                          className="truncate text-sm font-medium text-slate-900"
                          title={leave.employeeName || "N/A"}
                        >
                          {leave.employeeName || "N/A"}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                          {[leave.employeeCode, leave.employeeRole]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                      </td>
                      <td className="max-w-[160px] px-3 py-2 text-xs text-slate-600">
                        <span
                          className="block truncate"
                          title={leave.department || "N/A"}
                        >
                          {leave.department || "N/A"}
                        </span>
                      </td>
                      <td className="max-w-[140px] px-3 py-2 text-xs text-slate-600">
                        <span
                          className="block truncate"
                          title={leave.leaveType || "N/A"}
                        >
                          {leave.leaveType || "N/A"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-slate-600">
                        {from} – {to}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                        {leave.totalDays || 0}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getStatusStyle(
                            leave.status
                          )}`}
                        >
                          <span
                            aria-hidden="true"
                            className="h-1 w-1 rounded-full bg-current"
                          />
                          {leave.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        {canApproveReject ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateStatus(
                                  leave._id,
                                  "Approved"
                                )
                              }
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateStatus(
                                  leave._id,
                                  "Rejected"
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                            >
                              Reject
                            </button>
                          </div>
                        ) : leave.status === "Pending" ? (
                          <span className="text-xs text-slate-400">
                            Awaiting approval
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-semibold ${
                              leave.status === "Approved"
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {leave.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="8"
                    className="px-5 py-12 text-center"
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      {hasActiveFilters
                        ? "No leave requests match these filters"
                        : "No leave requests found"}
                    </p>
                    <p className="mx-auto mt-1 max-w-[320px] text-xs leading-relaxed text-slate-500">
                      {hasActiveFilters
                        ? "Try a different name, department or status — or clear the filters."
                        : "New applications will appear here for review."}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-3 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-800"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="pt-3 text-right text-xs tabular-nums text-slate-400">
        {leaves.length > 0
          ? `Showing ${filteredLeaves.length} of ${leaves.length}`
          : "No requests yet"}
      </p>
    </div>
  );
};

export default LeaveList;
