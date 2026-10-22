import axios from "axios";
import API_URL from "../api";
import { roleBadgeClass, roleLabel } from "./roles";

export const columns = [
  {
    name: <span title="Full staff identifier, never truncated">Employee ID</span>,
    selector: (row) => row.employeeId,
    // Compact but complete: fits IDs like MD-DE5CD3 in full with no
    // horizontal scroll. Chip stays nowrap so the whole ID always shows.
    grow: 0,
    minWidth: "112px",
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
            className="break-words text-sm font-medium text-slate-900"
            title={row.name}
          >
            {row.name || "N/A"}
          </p>

          <p
            className="break-all text-xs text-slate-500"
            title={row.email}
          >
            {row.email || ""}
          </p>
        </div>
      </div>
    ),
    sortable: true,
    grow: 4,
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
        className={`flex w-max max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight ${roleBadgeClass(
          row.role
        )} border-black/5`}
      >
        <span
          aria-hidden="true"
          className="h-1 w-1 shrink-0 rounded-full bg-current opacity-70"
        />
        <span className="min-w-0 truncate">{roleLabel(row.role)}</span>
      </span>
    ),
    sortable: true,
    grow: 0,
    // Widest badge ("Department Manager") is about 134px plus cell padding.
    minWidth: "180px",
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
        className="block whitespace-normal break-words text-[13px] leading-6 text-slate-600"
        title={row.dep_name}
      >
        {row.dep_name || "—"}
      </span>
    ),
    sortable: true,
    grow: 5,
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
        className="block whitespace-normal break-words text-[13px] leading-6 text-slate-600"
        title={row.designation}
      >
        {row.designation || "—"}
      </span>
    ),
    sortable: true,
    grow: 7,
    minWidth: "105px",
    style: {
      overflow: "hidden",
      whiteSpace: "normal",
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
