import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DataTable from "react-data-table-component";
import axios from "axios";
import { FaCheck, FaChevronDown, FaTimes, FaUsers } from "react-icons/fa";
import Add from "./Add";
import Edit from "./Edit";
import EmployeeDetailsModal from "./EmployeeDetailsModal";
import { columns } from "../../utils/EmployeeHelper";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import Loader from "../common/Loader";
import {
  CAPABILITIES,
  ROLE_OPTIONS,
  hasCapability,
  roleLabel,
  roleLevel,
} from "../../utils/roles";

// Listbox dropdown styled like the team attendance department menu.
const FilterMenu = ({ id, label, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((item) => item.id === value) || options[0];

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

  const choose = (nextId) => {
    onChange(nextId);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative mt-1">
      <button
        type="button"
        id={id}
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
          aria-label={label}
          className="absolute left-0 top-full z-30 mt-2 w-max min-w-full max-w-xs rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          {options.map((item) => {
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

const EmployeePopup = ({ title, subtitle, onClose, children }) => {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:left-64"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-md"
      />
      <div className="relative flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-3 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close popup"
            autoFocus
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
};

const List = () => {
  const { user, getToken } = useAuth();

  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [departments, setDepartments] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Stable handlers so the popups' effects don't re-run on every render.
  const closeAdd = useCallback(() => setShowAdd(false), []);
  const closeEdit = useCallback(() => setEditId(null), []);
  const closeDetails = useCallback(() => setDetailsId(null), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (search.trim() !== debouncedSearch) {
      return;
    }

    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;

    const fetchDepartments = async () => {
      try {
        const token = await getToken();

        if (!token || cancelled) {
          return;
        }

        const response = await axios.get(
          `${API_URL}/api/department`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (
          !cancelled &&
          response.data.success
        ) {
          setDepartments(
            response.data.departments || []
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.log(
            "FETCH DEPARTMENTS ERROR:",
            error.response?.status,
            error.response?.data ||
              error.message
          );
        }
      }
    };

    if (getToken) {
      fetchDepartments();
    }

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    if (!getToken) {
      return;
    }

    const controller =
      new AbortController();

    const fetchEmployees = async () => {
      try {
        setEmpLoading(true);

        const token = await getToken();

        if (!token) {
          return;
        }

        const params = {
          page,
          limit,
        };

        if (debouncedSearch) {
          params.search = debouncedSearch;
        }

        if (roleFilter) {
          params.role = roleFilter;
        }

        if (departmentFilter) {
          params.department =
            departmentFilter;
        }

        const response = await axios.get(
          `${API_URL}/api/employee`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params,
            signal: controller.signal,
          }
        );

        if (
          response.data.success
        ) {
          const employeeData =
            response.data.employees || [];

          const data = employeeData.map(
            (emp) => ({
              _id: emp._id,
              userId: emp.userId,
              employeeId:
                emp.employeeId,
              name: emp.name,
              email: emp.email,
              role: emp.role,
              dep_name: emp.dep_name,
              designation:
                emp.designation,
              dob: emp.dob
                ? new Date(
                    emp.dob
                  ).toLocaleDateString(
                    "en-GB"
                  )
                : "N/A",
              profileImage:
                emp.profileImage,
            })
          );

          setEmployees(data);

          setTotalRows(
            response.data.pagination
              ?.total || 0
          );

          setTotalPages(
            response.data.pagination
              ?.totalPages || 0
          );
        }
      } catch (error) {
        if (
          axios.isCancel(error) ||
          error.code === "ERR_CANCELED"
        ) {
          return;
        }

        console.log(
          "FETCH EMPLOYEES ERROR:",
          error.response?.status,
          error.response?.data ||
            error.message
        );

        alert(
          error.response?.data?.error ||
            "Something went wrong while fetching employees"
        );
      } finally {
        if (!controller.signal.aborted) {
          setEmpLoading(false);
        }
      }
    };

    fetchEmployees();

    return () => {
      controller.abort();
    };
  }, [
    getToken,
    page,
    limit,
    debouncedSearch,
    roleFilter,
    departmentFilter,
    refreshKey,
  ]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  const handleRoleChange = (id) => {
    setRoleFilter(id);
    setPage(1);
  };

  const handleDepartmentChange = (id) => {
    setDepartmentFilter(id);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setRoleFilter("");
    setDepartmentFilter("");
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePerRowsChange = (
    newLimit,
    newPage
  ) => {
    setLimit(newLimit);
    setPage(newPage);
  };

  const availableRoles = ROLE_OPTIONS.filter(
    (role) => roleLevel(user?.role) >= role.level
  );

  const canAddEmployee = hasCapability(
    user?.role,
    CAPABILITIES.PEOPLE_MANAGE
  );

  const hasActiveFilters = Boolean(
    search.trim() || roleFilter || departmentFilter
  );

  const activeDepartmentName = useMemo(() => {
    if (!departmentFilter) return "";
    return (
      departments.find(
        (department) => department._id === departmentFilter
      )?.dep_name || "Filtered department"
    );
  }, [departments, departmentFilter]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-brand-950">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-800 text-xl text-white">
              <FaUsers aria-hidden="true" />
            </span>
            Employee Management
          </h1>

          <div className="mt-4 flex flex-wrap gap-3">
            {hasActiveFilters && (
              <div className="rounded-xl bg-brand-800 px-3.5 py-2 text-white">
                <p className="max-w-[320px] truncate text-sm font-medium">
                  {[
                    debouncedSearch && `“${debouncedSearch}”`,
                    roleFilter && roleLabel(roleFilter),
                    departmentFilter && activeDepartmentName,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Active filters"}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

        {/* Filters — one bordered strip, same layout as the leave page */}
        <div className="mt-5 grid shrink-0 grid-cols-1 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white lg:grid-cols-[calc(25%+110px)_repeat(3,minmax(0,1fr))] lg:divide-x lg:divide-y-0">
          <div className="relative min-w-0 px-5 py-3">
            <label
              htmlFor="employee-search"
              className="block text-[11px] font-medium uppercase tracking-wide text-slate-400"
            >
              Search
            </label>
            <input
              id="employee-search"
              type="text"
              placeholder="Search by name, ID or email..."
              value={search}
              onChange={handleSearch}
              style={{ outline: "none" }}
              className="mt-1 w-full min-w-0 bg-transparent pr-6 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute bottom-3 right-5 text-slate-400 transition hover:text-slate-700"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className="min-w-0 px-5 py-3">
            <label
              htmlFor="employee-role-filter"
              className="block text-[11px] font-medium uppercase tracking-wide text-slate-400"
            >
              Role
            </label>
            <FilterMenu
              id="employee-role-filter"
              label="Role"
              value={roleFilter}
              onChange={handleRoleChange}
              options={[
                { id: "", label: "All roles" },
                ...availableRoles.map((role) => ({
                  id: role.value,
                  label: role.label,
                })),
              ]}
            />
          </div>

          <div className="min-w-0 px-5 py-3">
            <label
              htmlFor="employee-department-filter"
              className="block text-[11px] font-medium uppercase tracking-wide text-slate-400"
            >
              Department
            </label>
            <FilterMenu
              id="employee-department-filter"
              label="Department"
              value={departmentFilter}
              onChange={handleDepartmentChange}
              options={[
                { id: "", label: "All departments" },
                ...departments
                  .filter((department) => department.kind !== "team")
                  .map((department) => ({
                    id: department._id,
                    label: department.dep_name,
                  })),
              ]}
            />
          </div>

          {canAddEmployee && (
            <div className="flex min-w-0 items-center px-3 py-3">
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  +
                </span>
                Add Employee
              </button>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-[12px] text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {employees.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-800">
                {totalRows}
              </span>{" "}
              matching records
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-brand-700 transition hover:bg-brand-50 hover:text-brand-800"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Directory table — compact fixed layout fits without horizontal scrolling */}
        <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-brand-50/70 to-white px-6 py-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">Staff directory</h2>
            </div>
            {totalRows > 0 && (
              <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium tabular-nums text-brand-800 ring-1 ring-brand-100">
                Page {page} of {Math.max(totalPages, 1)}
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1">
            <DataTable
              columns={columns}
              data={employees}
              pagination
              paginationServer
              paginationTotalRows={totalRows}
              paginationDefaultPage={page}
              paginationPerPage={limit}
              paginationRowsPerPageOptions={[5, 10, 20, 50, 100]}
              onChangePage={handlePageChange}
              onChangeRowsPerPage={handlePerRowsChange}
              progressPending={empLoading}
              progressComponent={
                <Loader label="Loading employees…" compact />
              }
              noDataComponent={
                <div className="flex w-full flex-col items-center gap-2 px-6 py-12 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-lg text-brand-700">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                      />
                    </svg>
                  </span>
                  <p className="text-sm font-semibold text-slate-800">
                    {hasActiveFilters
                      ? "No employees match these filters"
                      : "No employees found"}
                  </p>
                  <p className="max-w-[320px] text-xs leading-relaxed text-slate-500">
                    {hasActiveFilters
                      ? "Try a different name, ID, role or department — or clear the filters to see everyone."
                      : "Add your first employee and they will appear here."}
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-1 rounded-lg bg-brand-700 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-800"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              }
              highlightOnHover
              pointerOnHover
              onRowClicked={(row) => setDetailsId(row._id)}
              responsive
              fixedHeader
              fixedHeaderScrollHeight="calc(100vh - 340px)"
              customStyles={{
                tableWrapper: {
                  style: {
                    width: "100%",
                    maxWidth: "100%",
                    overflowX: "hidden",
                    overflowY: "hidden",
                  },
                },
                table: {
                  style: {
                    width: "100%",
                    maxWidth: "100%",
                    tableLayout: "fixed",
                  },
                },
                headRow: {
                  style: {
                    minHeight: "40px",
                    backgroundColor: "rgba(247,242,251,0.6)",
                    borderBottom: "1px solid #ece5f5",
                  },
                },
                headCells: {
                  style: {
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    paddingLeft: "12px",
                    paddingRight: "12px",
                    paddingTop: "8px",
                    paddingBottom: "8px",
                  },
                },
                rows: {
                  style: {
                    minHeight: "62px",
                    fontSize: "14px",
                    color: "#334155",
                    borderBottom: "1px solid #f1f5f9",
                    overflow: "hidden",
                  },
                  highlightOnHoverStyle: {
                    backgroundColor: "#f7f2fb",
                    transitionDuration: "0.15s",
                    transitionProperty: "background-color",
                    borderBottomColor: "#e6d9f3",
                    outlineStyle: "none",
                  },
                  stripedStyle: {
                    backgroundColor: "#fdfcfe",
                  },
                },
                cells: {
                  style: {
                    overflow: "hidden",
                    paddingLeft: "12px",
                    paddingRight: "12px",
                    paddingTop: "8px",
                    paddingBottom: "8px",
                  },
                },
                pagination: {
                  style: {
                    minHeight: "52px",
                    borderTop: "1px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    fontSize: "12px",
                    paddingLeft: "20px",
                    paddingRight: "20px",
                  },
                },
              }}
              striped
            />
          </div>
        </div>

        <p className="shrink-0 pt-3 text-right text-xs tabular-nums text-slate-400">
          {totalRows > 0
            ? `Showing ${(page - 1) * limit + 1}–${Math.min(
                page * limit,
                totalRows
              )} of ${totalRows}`
            : "Directory is empty"}
        </p>

        {detailsId && (
          <EmployeeDetailsModal
            employeeId={detailsId}
            onClose={closeDetails}
            onEdit={(id) => setEditId(id)}
            active={!editId}
            refreshKey={refreshKey}
          />
        )}

        {showAdd && (
          <EmployeePopup
            title="Add employee"
            subtitle="They can sign in with their email and an email code."
            onClose={closeAdd}
          >
            <Add
              onSuccess={() => {
                setShowAdd(false);
                setRefreshKey((key) => key + 1);
              }}
              onCancel={closeAdd}
              bare
            />
          </EmployeePopup>
        )}

        {editId && (
          <EmployeePopup
            title="Edit employee"
            subtitle="Update this employee's record."
            onClose={closeEdit}
          >
            <Edit
              employeeId={editId}
              onSuccess={() => {
                // Back to the details popup, which reloads the saved record.
                setEditId(null);
                setRefreshKey((key) => key + 1);
              }}
              onCancel={closeEdit}
              bare
            />
          </EmployeePopup>
        )}
    </div>
  );
};

export default List;
