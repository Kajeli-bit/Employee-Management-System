import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import API_URL from "../api";
import {
  canManageRole,
  roleBadgeClass,
  roleLabel,
} from "./roles";
import { formatCurrency } from "./format";

const headerCell = "Employee directory column";

export const columns = [
  {
    name: <span title={headerCell}>No.</span>,
    selector: (row) => row.sno,
    width: "40px",
    center: true,
    cell: (row) => (
      <span className="font-mono text-xs tabular-nums text-slate-400">
        {String(row.sno).padStart(2, "0")}
      </span>
    ),
  },
  {
    name: <span title="Full staff identifier, never truncated">Employee ID</span>,
    selector: (row) => row.employeeId,
    // Compact but complete: fits IDs like MD-DE5CD3 in full with no
    // horizontal scroll. Chip stays nowrap so the whole ID always shows.
    width: "112px",
    left: true,
    style: {
      overflow: "hidden",
    },
    cell: (row) => (
      <span
        title={row.employeeId || "No ID"}
        className="inline-flex max-w-full items-center whitespace-nowrap rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-brand-800"
      >
        {row.employeeId || "—"}
      </span>
    ),
  },
  {
    name: <span title="Name and work email">Employee</span>,
    selector: (row) => row.name,
    cell: (row) => (
      <div className="flex min-w-0 items-center gap-2.5 py-1">
        {row.profileImage ? (
          <img
            src={row.profileImage}
            alt=""
            loading="lazy"
            className="h-9 w-9 shrink-0 rounded-full bg-brand-100 object-cover ring-1 ring-slate-200"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white"
          >
            {(row.name || "N")
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </span>
        )}

        <div className="min-w-0 leading-snug">
          <p
            className="truncate text-sm font-medium text-slate-900"
            title={row.name}
          >
            {row.name || "N/A"}
          </p>

          <p
            className="truncate text-xs text-slate-500"
            title={row.email}
          >
            {row.email || ""}
          </p>
        </div>
      </div>
    ),
    sortable: true,
    grow: 2,
    minWidth: "160px",
    style: {
      overflow: "hidden",
    },
  },
  {
    name: <span title="System role">Role</span>,
    selector: (row) => roleLabel(row.role),
    cell: (row) => (
      <span
        title={roleLabel(row.role)}
        className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${roleBadgeClass(
          row.role
        )} border-black/5`}
      >
        <span
          aria-hidden="true"
          className="h-1 w-1 shrink-0 rounded-full bg-current opacity-70"
        />
        <span className="truncate">{roleLabel(row.role)}</span>
      </span>
    ),
    sortable: true,
    width: "124px",
    left: true,
    style: {
      overflow: "hidden",
    },
  },
  {
    name: <span title="Department">Department</span>,
    selector: (row) => row.dep_name,
    cell: (row) => (
      <span
        className="block whitespace-normal text-[13px] leading-6 text-slate-600"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
        title={row.dep_name}
      >
        {row.dep_name || "—"}
      </span>
    ),
    sortable: true,
    grow: 1,
    minWidth: "105px",
    style: {
      overflow: "hidden",
      whiteSpace: "normal",
    },
  },
  {
    name: <span title="Job title">Designation</span>,
    selector: (row) => row.designation,
    cell: (row) => (
      <span
        className="block whitespace-normal text-[13px] leading-6 text-slate-600"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
        title={row.designation}
      >
        {row.designation || "—"}
      </span>
    ),
    sortable: true,
    grow: 1,
    minWidth: "105px",
    style: {
      overflow: "hidden",
      whiteSpace: "normal",
    },
  },
  {
    name: <span title="Monthly gross">Salary</span>,
    selector: (row) => Number(row.salary) || 0,
    cell: (row) => (
      <span
        title={formatCurrency(row.salary)}
        className="whitespace-nowrap text-[13px] font-medium tabular-nums text-slate-900"
      >
        {formatCurrency(row.salary)}
      </span>
    ),
    sortable: true,
    width: "92px",
    right: true,
    style: {
      overflow: "hidden",
    },
  },
  {
    name: <span title="Direct line">Phone</span>,
    selector: (row) => row.phone,
    cell: (row) => (
      <span
        title={row.phone || "No phone number"}
        className="whitespace-nowrap font-mono text-xs tabular-nums text-slate-600"
      >
        {row.phone || "—"}
      </span>
    ),
    width: "102px",
    left: true,
    style: {
      overflow: "hidden",
    },
  },
  {
    name: <span title="Open, edit or manage this employee">Actions</span>,
    cell: (row) => <EmployeeButtons row={row} />,
    width: "176px",
    center: true,
    allowOverflow: true,
    style: {
      overflow: "hidden",
    },
  },
];

export const fetchDepartments = async (getToken) => {
  try {
    if (typeof getToken !== "function") {
      return [];
    }

    const token = await getToken();

    if (!token) {
      return [];
    }

    const response = await axios.get(
      `${API_URL}/api/department`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.success
      ? response.data.departments || []
      : [];
  } catch (error) {
    console.log(
      "FETCH DEPARTMENTS ERROR:",
      error.response?.status,
      error.response?.data || error.message
    );

    return [];
  }
};

export const fetchEmployees = async (
  getToken,
  options = {}
) => {
  try {
    if (typeof getToken !== "function") {
      return [];
    }

    const token = await getToken();

    if (!token) {
      return [];
    }

    const {
      page = 1,
      limit = 10,
      search = "",
      role = "",
      department = "",
    } = options;

    const response = await axios.get(
      `${API_URL}/api/employee`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          page,
          limit,
          ...(search.trim() && {
            search: search.trim(),
          }),
          ...(role && { role }),
          ...(department && { department }),
        },
      }
    );

    return response.data.success
      ? response.data.employees || []
      : [];
  } catch (error) {
    console.log(
      "FETCH EMPLOYEES ERROR:",
      error.response?.status,
      error.response?.data || error.message
    );

    return [];
  }
};

export const EmployeeButtons = ({ row }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isSelf =
    user?._id &&
    row?.userId &&
    user._id === row.userId;

  const canManage =
    !isSelf &&
    canManageRole(user?.role, row?.role);

  if (!isSelf && !canManage) {
    return (
      <span className="text-[11px] text-slate-400">Restricted</span>
    );
  }

  const base =
    "inline-flex items-center justify-center rounded-md border px-2.5 py-1.5 text-[11px] font-semibold leading-none transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-1 py-0.5">
      <button
        type="button"
        title={`View ${row.name || "employee"} profile`}
        onClick={() =>
          navigate(
            `/admin-dashboard/employee/${row._id}`
          )
        }
        className={`${base} border-brand-200 bg-brand-700 text-white shadow-sm hover:bg-brand-800`}
      >
        View
      </button>

      {canManage && (
        <>
          <button
            type="button"
            title={`Edit ${row.name || "employee"}`}
            onClick={() =>
              navigate(
                `/admin-dashboard/employees/edit/${row._id}`
              )
            }
            className={`${base} border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-900 hover:text-white`}
          >
            Edit
          </button>

          <button
            type="button"
            title={`Salary history for ${row.name || "employee"}`}
            onClick={() =>
              navigate(
                `/admin-dashboard/salary-history/${row._id}`
              )
            }
            className={`${base} border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-600 hover:text-white`}
          >
            Salary
          </button>

          <button
            type="button"
            title={`Leave records for ${row.name || "employee"}`}
            onClick={() =>
              navigate(
                `/admin-dashboard/employee-leaves/${row._id}`
              )
            }
            className={`${base} border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-500 hover:text-white`}
          >
            Leave
          </button>
        </>
      )}
    </div>
  );
};
