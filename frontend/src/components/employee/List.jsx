import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "react-data-table-component";
import axios from "axios";
import { FaUsers } from "react-icons/fa";
import { columns } from "../../utils/EmployeeHelper";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import {
  CAPABILITIES,
  ROLE_OPTIONS,
  hasCapability,
  roleLabel,
  roleLevel,
} from "../../utils/roles";

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
            (emp, index) => ({
              _id: emp._id,
              userId: emp.userId,
              sno:
                (page - 1) * limit +
                index +
                1,
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
              salary: emp.salary,
              phone: emp.phone,
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
  ]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  const handleRoleChange = (e) => {
    setRoleFilter(e.target.value);
    setPage(1);
  };

  const handleDepartmentChange = (e) => {
    setDepartmentFilter(
      e.target.value
    );
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

  const displayRole = roleLabel(user?.role) || "User";
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
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-slate-900">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-xl text-white shadow-sm">
              <FaUsers aria-hidden="true" />
            </span>
            Employee Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Everyone at Nilric, searchable by name, staff ID or email.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                Your role
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {displayRole}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                Employees
              </p>
              <p className="font-mono text-xl font-semibold tabular-nums text-slate-900">
                {totalRows}
              </p>
            </div>
            {hasActiveFilters && (
              <div className="rounded-2xl border border-brand-700 bg-brand-700 px-4 py-2 shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-brand-200">
                  Filtered
                </p>
                <p className="mt-0.5 max-w-[280px] truncate text-sm font-semibold text-white">
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

        {canAddEmployee && (
          <Link
            to="/admin-dashboard/add-employee"
            className="inline-flex shrink-0 items-center justify-center gap-2 self-end rounded-2xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              +
            </span>
            Add Employee
          </Link>
        )}
      </div>

        {/* Filters */}
        <div className="mt-5 shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12">
            <label className="relative block min-w-0 sm:col-span-2 lg:col-span-6">
              <span className="sr-only">Search employees</span>
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-4 w-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
                  />
                </svg>
              </span>

              <input
                type="text"
                placeholder="Search by name, ID or email..."
                value={search}
                onChange={handleSearch}
                className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-700"
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
            </label>

            <div className="min-w-0 sm:col-span-1 lg:col-span-3">
              <label className="sr-only" htmlFor="employee-role-filter">
                Filter by role
              </label>
              <select
                id="employee-role-filter"
                value={roleFilter}
                onChange={handleRoleChange}
                className="h-10 w-full min-w-0 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
              >
                <option value="">All roles</option>

                {availableRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 sm:col-span-1 lg:col-span-3">
              <label
                className="sr-only"
                htmlFor="employee-department-filter"
              >
                Filter by department
              </label>
              <select
                id="employee-department-filter"
                value={departmentFilter}
                onChange={handleDepartmentChange}
                className="h-10 w-full min-w-0 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
              >
                <option value="">All departments</option>

                {departments.map((department) => (
                  <option
                    key={department._id}
                    value={department._id}
                  >
                    {department.dep_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-slate-200 pt-2">
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
        </div>

        {/* Directory table — compact fixed layout fits without horizontal scrolling */}
        <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Staff directory</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Full staff IDs always visible — no horizontal scrolling.
              </p>
            </div>
            {totalRows > 0 && (
              <p className="text-[11px] tabular-nums text-slate-400">
                Page {page} of {Math.max(totalPages, 1)}
              </p>
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
                <div className="flex w-full flex-col items-center gap-3 py-12 text-center">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700" />
                  <p className="text-sm font-medium text-slate-500">
                    Loading employees...
                  </p>
                </div>
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
                      : "Once staff are added they will appear here with full IDs, roles and contacts."}
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
    </div>
  );
};

export default List;
