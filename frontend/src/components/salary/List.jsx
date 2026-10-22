
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import {
  CAPABILITIES,
  canManageRole,
  hasCapability,
  isManagementRole,
} from "../../utils/roles";

const List = () => {
  const navigate = useNavigate();
  const { user, getToken } = useAuth();

  const [salaries, setSalaries] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchSalaries = async () => {
      try {
        setLoading(true);
        setError("");

        const token = await getToken();

        if (!token) {
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }

        const response = await axios.get(
          `${API_URL}/api/salary`,
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
          setSalaries(
            response.data.salaries || []
          );
        }
      } catch (error) {
        console.log(
          "FETCH SALARY ERROR:",
          error.response?.status,
          error.response?.data || error.message
        );

        if (!cancelled) {
          setError(
            error.response?.data?.error ||
              "Unable to fetch salary records"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchSalaries();

    return () => {
      cancelled = true;
    };
  }, []);

  const canManageSalary = (salary) => {
    if (!user || !salary) {
      return false;
    }

    if (salary.status === "Paid") {
      return false;
    }

    const targetRole = salary.employeeRole;

    if (!targetRole) {
      return false;
    }

    if (!isManagementRole(user.role)) {
      return false;
    }

    return canManageRole(
      user.role,
      targetRole
    );
  };

  const searchText = search
    .toLowerCase()
    .trim();

  const filteredSalaries = salaries.filter(
    (salary) => {
      if (!searchText) {
        return true;
      }

      return (
        salary.employeeId
          ?.toLowerCase()
          .includes(searchText) ||
        salary.employeeName
          ?.toLowerCase()
          .includes(searchText) ||
        salary.employeeRole
          ?.toLowerCase()
          .includes(searchText) ||
        salary.department
          ?.toLowerCase()
          .includes(searchText)
      );
    }
  );

  const canAddSalary = hasCapability(
    user?.role,
    CAPABILITIES.SALARIES_MANAGE
  );

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-5">
          Salary Management
        </h2>

        <div className="bg-white rounded-2xl shadow-lg border p-10 text-center">
          <div className="w-10 h-10 mx-auto border-4 border-gray-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="mt-4 text-gray-500">
            Loading salary records...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-2xl font-bold text-gray-800">
            Salary Management
          </h2>

          {canAddSalary && (
            <Link
              to="/admin-dashboard/salary/add"
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Add Salary
            </Link>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg border p-8 text-center">
          <p className="text-red-500 mb-4">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold text-gray-800">
          Salary Management
        </h2>

        {canAddSalary && (
          <Link
            to="/admin-dashboard/salary/add"
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-300"
          >
            Add Salary
          </Link>
        )}
      </div>

      <div className="mb-4 w-80 max-w-full rounded-2xl border border-slate-200 bg-white px-5 py-3">
        <label
          htmlFor="salary-search"
          className="block text-[11px] font-medium uppercase tracking-wide text-slate-400"
        >
          Search
        </label>
        <input
          id="salary-search"
          type="text"
          placeholder="Employee, ID, role…"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          style={{ outline: "none" }}
          className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400"
        />
      </div>

      <div className="mb-3 text-sm text-gray-500">
        Showing{" "}
        <span className="font-semibold text-gray-700">
          {filteredSalaries.length}
        </span>{" "}
        salary record
        {filteredSalaries.length !== 1
          ? "s"
          : ""}
      </div>

      <div className="bg-white rounded-2xl shadow-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brand-600 text-white">
            <tr>
              <th className="px-2 py-3">Employee ID</th>
              <th className="px-2 py-3">Employee Name</th>
              <th className="px-2 py-3">Role</th>
              <th className="px-2 py-3">Department</th>
              <th className="px-2 py-3">Basic Salary</th>
              <th className="px-2 py-3">Allowances</th>
              <th className="px-2 py-3">Deductions</th>
              <th className="px-2 py-3">Net Salary</th>
              <th className="px-2 py-3">Pay Date</th>
              <th className="px-2 py-3">Status</th>
              <th className="px-2 py-3">Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredSalaries.length > 0 ? (
              filteredSalaries.map((salary) => {
                const canEdit =
                  canManageSalary(salary);

                return (
                  <tr
                    key={salary._id}
                    className="border-b hover:bg-gray-50 text-center transition"
                  >
                    <td className="px-2 py-3">
                      {salary.employeeId || "N/A"}
                    </td>

                    <td className="px-2 py-3">
                      {salary.employeeName || "N/A"}
                    </td>

                    <td className="px-2 py-3 capitalize">
                      {salary.employeeRole || "N/A"}
                    </td>

                    <td className="px-2 py-3">
                      {salary.department || "N/A"}
                    </td>

                    <td className="px-2 py-3 font-medium">
                      ₹
                      {Number(
                        salary.basicSalary || 0
                      ).toLocaleString("en-IN")}
                    </td>

                    <td className="px-2 py-3">
                      ₹
                      {Number(
                        salary.allowances || 0
                      ).toLocaleString("en-IN")}
                    </td>

                    <td className="px-2 py-3">
                      ₹
                      {Number(
                        salary.deductions || 0
                      ).toLocaleString("en-IN")}
                    </td>

                    <td className="px-2 py-3 font-semibold text-brand-700">
                      ₹
                      {Number(
                        salary.netSalary || 0
                      ).toLocaleString("en-IN")}
                    </td>

                    <td className="px-2 py-3">
                      {salary.payDate || "N/A"}
                    </td>

                    <td className="px-2 py-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          salary.status === "Paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {salary.status || "Pending"}
                      </span>
                    </td>

                    <td className="px-2 py-3">
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/admin-dashboard/salary/edit/${salary._id}`
                            )
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm transition duration-300 hover:scale-105"
                        >
                          Edit
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          {salary.status === "Paid"
                            ? "Paid"
                            : "View only"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan="11"
                  className="py-8 text-center text-gray-500"
                >
                  {searchText
                    ? "No salary records match your search."
                    : "No salary records found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default List;

