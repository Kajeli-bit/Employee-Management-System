
import { useEffect, useState } from "react";
import Loader from "../common/Loader";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";

const EmployeeLeave = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, getToken } = useAuth();

  const [employee, setEmployee] = useState({});
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const fetchLeaves = async () => {
      try {
        setLoading(true);
        setAccessDenied(false);

        const token = await getToken();

        if (!token) {
          alert(
            "Authentication token not found. Please login again."
          );
          return;
        }

        const response = await axios.get(
          `${API_URL}/api/leave/employee/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success) {
          setLeaves(response.data.leaves || []);
          setEmployee(response.data.employee || {});
        }
      } catch (error) {
        console.log(
          "FETCH EMPLOYEE LEAVES ERROR:",
          error.response?.status,
          error.response?.data || error.message
        );

        if (
          error.response?.status === 403 ||
          error.response?.status === 404
        ) {
          setAccessDenied(true);
        } else {
          alert(
            error.response?.data?.error ||
              "Failed to fetch employee leave history"
          );
        }
      } finally {
        setLoading(false);
      }
    };

    if (id && user && getToken) {
      fetchLeaves();
    }
  }, [id, user, getToken]);

  const badgeColor = (status) => {
    if (status === "Approved") {
      return "bg-green-100 text-green-700";
    }

    if (status === "Rejected") {
      return "bg-red-100 text-red-700";
    }

    return "bg-yellow-100 text-yellow-700";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader label="Loading leave history…" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="bg-white shadow-lg rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">
            Access Denied
          </h2>

          <p className="text-gray-600 mb-5">
            You are not allowed to view this employee leave history.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/admin-dashboard/leave")
            }
            className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg"
          >
            Back to Leave
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-display text-4xl font-medium tracking-tight text-brand-950">
            Employee Leave History
          </h2>

          <button
            type="button"
            onClick={() =>
              navigate("/admin-dashboard/leave")
            }
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition cursor-pointer"
          >
            Back
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4 text-brand-600">
            Employee Information
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-gray-500 text-sm">
                Employee ID
              </p>

              <p className="font-semibold">
                {employee.employeeCode || "N/A"}
              </p>
            </div>

            <div>
              <p className="text-gray-500 text-sm">
                Employee Name
              </p>

              <p className="font-semibold">
                {employee.name || "N/A"}
              </p>
            </div>

            <div>
              <p className="text-gray-500 text-sm">
                Role
              </p>

              <p className="font-semibold capitalize">
                {employee.role || "N/A"}
              </p>
            </div>

            <div>
              <p className="text-gray-500 text-sm">
                Department
              </p>

              <p className="font-semibold">
                {employee.department || "N/A"}
              </p>
            </div>

            <div>
              <p className="text-gray-500 text-sm">
                Leave Records
              </p>

              <p className="font-semibold">
                {leaves.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-brand-600 text-white">
              <tr>
                <th className="py-3 px-4">
                  S.No
                </th>

                <th className="py-3 px-4">
                  Leave Type
                </th>

                <th className="py-3 px-4">
                  From
                </th>

                <th className="py-3 px-4">
                  To
                </th>

                <th className="py-3 px-4">
                  Days
                </th>

                <th className="py-3 px-4">
                  Reason
                </th>

                <th className="py-3 px-4">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {leaves.length > 0 ? (
                leaves.map((leave, index) => (
                  <tr
                    key={leave._id}
                    className="border-b hover:bg-gray-100 transition"
                  >
                    <td className="text-center py-3">
                      {index + 1}
                    </td>

                    <td className="text-center">
                      {leave.leaveType || "N/A"}
                    </td>

                    <td className="text-center">
                      {leave.fromDate
                        ? new Date(
                            leave.fromDate
                          ).toLocaleDateString("en-GB")
                        : "N/A"}
                    </td>

                    <td className="text-center">
                      {leave.toDate
                        ? new Date(
                            leave.toDate
                          ).toLocaleDateString("en-GB")
                        : "N/A"}
                    </td>

                    <td className="text-center font-semibold">
                      {leave.totalDays || 0}
                    </td>

                    <td
                      className="text-left max-w-[300px] truncate"
                      title={leave.reason || "N/A"}
                    >
                      {leave.reason || "N/A"}
                    </td>

                    <td className="text-center">
                      <span
                        className={`inline-block px-4 py-1 rounded-full text-sm font-semibold ${badgeColor(
                          leave.status
                        )}`}
                      >
                        {leave.status || "Pending"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="text-center py-8 text-gray-500"
                  >
                    No Leave Records Found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeLeave;
