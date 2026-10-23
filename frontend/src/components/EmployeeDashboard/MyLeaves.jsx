import { useEffect, useMemo, useState } from "react";
import Loader from "../common/Loader";
import axios from "axios";
import { FaCalendarAlt, FaPen, FaPlus, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { formatDate } from "../../utils/format";
import { useWorkspace } from "../../utils/workspace";
import FilterMenu from "../ui/FilterMenu";
import ApplyLeave from "./ApplyLeave";

const STATUS_FILTERS = [
  { key: "", label: "All requests", tone: "text-slate-900" },
  { key: "Pending", label: "Pending", tone: "text-amber-700" },
  { key: "Approved", label: "Approved", tone: "text-emerald-700" },
  { key: "Rejected", label: "Rejected", tone: "text-rose-700" },
];

const statusTone = (status) =>
  status === "Approved"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "Rejected"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-amber-200 bg-amber-50 text-amber-800";

const statusDot = (status) =>
  status === "Approved"
    ? "bg-emerald-500"
    : status === "Rejected"
      ? "bg-rose-500"
      : "bg-amber-500";

const FilterStat = ({
  label,
  value,
  tone = "text-slate-900",
  active,
  onClick,
  className = "",
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`px-4 py-2.5 text-left transition hover:bg-slate-50 xl:px-3 ${
      active ? "bg-brand-50" : ""
    } ${className}`}
  >
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p
      className={`mt-1 font-mono text-2xl leading-none font-semibold tabular-nums ${tone}`}
    >
      {value}
    </p>
  </button>
);

const MyLeaves = () => {
  const { user, getToken } = useAuth();
  const workspace = useWorkspace();
  const navigate = useNavigate();

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("newest");

  const [applying, setApplying] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Everything that touches state runs after an await, so the effect never
  // queues renders in the same pass that mounts it.
  useEffect(() => {
    if (!user || !getToken) {
      return undefined;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const token = await getToken();
        const response = await axios.get(`${API_URL}/api/leave/my-leave`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!cancelled && response.data.success) {
          setLeaves(response.data.leaves || []);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error ||
              "Unable to load your leave requests right now."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [user, getToken, refreshKey]);

  useEffect(() => {
    if (!applying) {
      return undefined;
    }

    const onKey = (event) => {
      if (event.key === "Escape") {
        setApplying(false);
      }
    };

    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [applying]);

  const typeOptions = useMemo(
    () => [...new Set(leaves.map((leave) => leave.leaveType).filter(Boolean))],
    [leaves]
  );

  const ofType = useMemo(
    () => leaves.filter((leave) => !type || leave.leaveType === type),
    [leaves, type]
  );

  const counts = useMemo(
    () => ({
      total: ofType.length,
      Pending: ofType.filter((leave) => leave.status === "Pending").length,
      Approved: ofType.filter((leave) => leave.status === "Approved").length,
      Rejected: ofType.filter((leave) => leave.status === "Rejected").length,
    }),
    [ofType]
  );

  const visible = useMemo(() => {
    const list = ofType.filter((leave) => !status || leave.status === status);

    return [...list].sort((a, b) => {
      const first = new Date(a.fromDate).getTime() || 0;
      const second = new Date(b.fromDate).getTime() || 0;

      return sort === "newest" ? second - first : first - second;
    });
  }, [ofType, status, sort]);

  const hasFilters = Boolean(status || type);

  const clearFilters = () => {
    setStatus("");
    setType("");
  };

  const handleApplied = () => {
    setApplying(false);
    setStatus("Pending");
    setRefreshKey((key) => key + 1);
  };

  const countFor = (key) =>
    loading ? "—" : key === "" ? counts.total : counts[key] || 0;

  return (
    <div
      className={
        workspace.inAdmin
          ? "mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6"
          : "w-full px-4 pb-10 pt-8 sm:px-6 lg:px-8"
      }
    >
      <h1 className="font-display text-4xl font-medium tracking-tight text-brand-950 sm:text-5xl">
        My leave requests
      </h1>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-y-0 sm:divide-x lg:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,0.85fr))_minmax(0,1.15fr)_minmax(0,0.95fr)_minmax(0,auto)]">
        {STATUS_FILTERS.map((filter, index) => (
          <FilterStat
            key={filter.key || "all"}
            label={filter.label}
            value={countFor(filter.key)}
            tone={filter.tone}
            active={status === filter.key}
            onClick={() => setStatus(filter.key)}
            className={
              index === 0
                ? "rounded-tl-2xl"
                : "sm:border-t sm:border-slate-100 lg:border-t-0"
            }
          />
        ))}

        <div className="min-w-0 px-4 py-3 sm:border-t sm:border-slate-100 xl:border-t-0">
          <label
            htmlFor="leave-type-filter"
            className="block text-[11px] font-medium uppercase tracking-wide text-slate-400"
          >
            Leave type
          </label>

          <FilterMenu
            id="leave-type-filter"
            label="Leave type"
            value={type}
            onChange={setType}
            options={[
              { id: "", label: "All leave types" },
              ...typeOptions.map((option) => ({ id: option, label: option })),
            ]}
          />
        </div>

        <div className="min-w-0 px-4 py-3 sm:border-t sm:border-slate-100 xl:border-t-0">
          <label
            htmlFor="leave-sort"
            className="block text-[11px] font-medium uppercase tracking-wide text-slate-400"
          >
            Sort
          </label>

          <FilterMenu
            id="leave-sort"
            label="Sort requests"
            value={sort}
            align="right"
            onChange={setSort}
            options={[
              { id: "newest", label: "Newest first" },
              { id: "oldest", label: "Oldest first" },
            ]}
          />
        </div>

        <div className="col-span-2 flex min-w-0 items-center justify-end px-3 py-3 sm:col-span-3 sm:border-t sm:border-slate-100 lg:col-span-2 xl:col-span-1 xl:border-t-0">
          <button
            type="button"
            onClick={() => setApplying(true)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:w-auto sm:px-5 lg:w-full"
          >
            <FaPlus aria-hidden="true" className="text-xs" />
            Apply for leave
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">History</h2>

          <div className="flex items-baseline gap-3">
            {!loading && leaves.length > 0 && (
              <span className="font-mono text-xs text-slate-500">
                {visible.length} of {leaves.length} shown
              </span>
            )}

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] font-semibold text-brand-700 transition hover:text-brand-900"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-brand-50/50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Leave type</th>
                <th className="px-3 py-2.5 font-semibold">Dates</th>
                <th className="px-3 py-2.5 text-center font-semibold">Days</th>
                <th className="px-3 py-2.5 font-semibold">Reason</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-5 py-2.5 text-right font-semibold">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <Loader label="Loading your leaves…" />
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                      <FaCalendarAlt aria-hidden="true" />
                    </span>

                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {leaves.length === 0
                        ? "No leave requests yet"
                        : "Nothing matches these filters"}
                    </p>

                    <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                      {leaves.length === 0
                        ? "When you need time off, send a request here and your manager will review it."
                        : "Try a different status or leave type."}
                    </p>

                    <button
                      type="button"
                      onClick={
                        leaves.length === 0
                          ? () => setApplying(true)
                          : clearFilters
                      }
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-800"
                    >
                      {leaves.length === 0 ? "Apply for leave" : "Clear filters"}
                    </button>
                  </td>
                </tr>
              ) : (
                visible.map((leave) => (
                  <tr
                    key={leave._id}
                    className="text-slate-700 transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {leave.leaveType || "Leave"}
                    </td>

                    <td className="px-3 py-3 text-xs text-slate-600">
                      {formatDate(leave.fromDate)}
                      <span aria-hidden="true" className="px-1.5 text-slate-300">
                        →
                      </span>
                      {formatDate(leave.toDate)}
                    </td>

                    <td className="px-3 py-3 text-center font-mono text-xs tabular-nums text-slate-700">
                      {leave.totalDays ?? "—"}
                    </td>

                    <td className="max-w-[320px] px-3 py-3">
                      <p
                        title={leave.reason || ""}
                        className="truncate text-xs text-slate-600"
                      >
                        {leave.reason || "—"}
                      </p>
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(
                          leave.status
                        )}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${statusDot(
                            leave.status
                          )}`}
                        />
                        {leave.status}
                      </span>
                    </td>

                    <td className="px-5 py-3 text-right">
                      {leave.status === "Pending" ? (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(workspace.editLeave(leave._id))
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                        >
                          <FaPen aria-hidden="true" className="text-[9px]" />
                          Edit
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {applying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setApplying(false)}
            className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-md"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Apply for leave"
            className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-display text-2xl font-medium tracking-tight text-brand-950">
                  Apply for leave
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Your manager receives it for approval.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setApplying(false)}
                aria-label="Close"
                autoFocus
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <ApplyLeave
                bare
                onCancel={() => setApplying(false)}
                onSuccess={handleApplied}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLeaves;
