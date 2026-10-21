import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/useAuth";
import API_URL from "../../api";
import { canManageRole, isManagementRole } from "../../utils/roles";

const LeaveList = () => {
  const { user, getToken } = useAuth();

  const [leaves, setLeaves] = useState([]);
  const [search, setSearch] = useState("");
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

  const getStatusColor = (status) => {
    if (status === "Approved") {
      return "bg-green-100 text-green-700";
    }

    if (status === "Rejected") {
      return "bg-red-100 text-red-700";
    }

    return "bg-yellow-100 text-yellow-700";
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

  const filteredLeaves = leaves.filter((leave) => {
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

  if (loading) {
    return (
      <div className="w-full h-full min-w-0 flex items-center justify-center bg-gray-50 overflow-hidden">
        <div className="text-gray-600 font-medium text-sm">
          Loading leave requests...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-w-0 bg-gray-50 p-3 overflow-hidden">
      <div className="w-full h-full min-w-0 flex flex-col overflow-hidden">

        <div className="shrink-0 flex items-center justify-between gap-4 mb-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-black truncate">
              Leave Management
            </h1>

            <p className="text-xs text-gray-500 mt-1 truncate">
              Review and manage employee leave requests
            </p>
          </div>

          <input
            type="text"
            placeholder="Search employee, role, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-[380px]
              max-w-[40%]
              shrink-0
              px-4
              py-2.5
              border
              border-gray-300
              rounded-lg
              text-sm
              bg-white
              outline-none
              focus:ring-2
              focus:ring-brand-500
            "
          />
        </div>

        <div className="flex-1 min-h-0 min-w-0 bg-white rounded-2xl shadow-md overflow-hidden">

          <table className="w-full h-auto table-fixed border-collapse text-center">

            <thead className="bg-brand-600 text-white">
              <tr className="h-11">

                <th className="w-[4%] px-1 text-xs font-semibold">
                  S.No
                </th>

                <th className="w-[12%] px-2 text-xs font-semibold">
                  Employee
                </th>

                <th className="w-[8%] px-1 text-xs font-semibold">
                  Role
                </th>

                <th className="w-[10%] px-2 text-xs font-semibold">
                  Department
                </th>

                <th className="w-[12%] px-2 text-xs font-semibold">
                  Leave Type
                </th>

                <th className="w-[9%] px-1 text-xs font-semibold">
                  From
                </th>

                <th className="w-[9%] px-1 text-xs font-semibold">
                  To
                </th>

                <th className="w-[5%] px-1 text-xs font-semibold">
                  Days
                </th>

                <th className="w-[9%] px-1 text-xs font-semibold">
                  Status
                </th>

                <th className="w-[22%] px-1 text-xs font-semibold">
                  Action
                </th>

              </tr>
            </thead>

            <tbody>
              {filteredLeaves.length > 0 ? (
                filteredLeaves.map((leave, index) => {
                  const canApproveReject =
                    leave.status === "Pending" &&
                    canManageLeave(leave);

                  return (
                    <tr
                      key={leave._id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition h-11"
                    >
                      <td className="px-1 text-xs text-gray-600">
                        {index + 1}
                      </td>

                      <td className="px-2 text-left min-w-0">
                        <p
                          className="text-xs font-semibold text-gray-800 truncate"
                          title={leave.employeeName || "N/A"}
                        >
                          {leave.employeeName || "N/A"}
                        </p>
                      </td>

                      <td className="px-1 text-xs capitalize truncate">
                        {leave.employeeRole || "N/A"}
                      </td>

                      <td className="px-2 text-xs truncate">
                        <span
                          className="block truncate"
                          title={leave.department || "N/A"}
                        >
                          {leave.department || "N/A"}
                        </span>
                      </td>

                      <td className="px-2 text-xs truncate">
                        <span
                          className="block truncate"
                          title={leave.leaveType || "N/A"}
                        >
                          {leave.leaveType || "N/A"}
                        </span>
                      </td>

                      <td className="px-1 text-xs whitespace-nowrap">
                        {leave.fromDate
                          ? new Date(
                              leave.fromDate
                            ).toLocaleDateString("en-GB")
                          : "N/A"}
                      </td>

                      <td className="px-1 text-xs whitespace-nowrap">
                        {leave.toDate
                          ? new Date(
                              leave.toDate
                            ).toLocaleDateString("en-GB")
                          : "N/A"}
                      </td>

                      <td className="px-1 text-xs font-semibold">
                        {leave.totalDays || 0}
                      </td>

                      <td className="px-1">
                        <span
                          className={`
                            inline-flex
                            px-2
                            py-1
                            rounded-full
                            text-[10px]
                            font-semibold
                            whitespace-nowrap
                            ${getStatusColor(
                              leave.status
                            )}
                          `}
                        >
                          {leave.status}
                        </span>
                      </td>

                      <td className="px-1">
                        {canApproveReject ? (
                          <div className="flex justify-center items-center gap-1">

                            <button
                              type="button"
                              onClick={() =>
                                updateStatus(
                                  leave._id,
                                  "Approved"
                                )
                              }
                              className="
                                px-2.5
                                py-1.5
                                rounded-md
                                bg-green-600
                                hover:bg-green-700
                                text-white
                                text-[10px]
                                font-semibold
                                cursor-pointer
                                transition
                                whitespace-nowrap
                              "
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
                              className="
                                px-2.5
                                py-1.5
                                rounded-md
                                bg-red-600
                                hover:bg-red-700
                                text-white
                                text-[10px]
                                font-semibold
                                cursor-pointer
                                transition
                                whitespace-nowrap
                              "
                            >
                              Reject
                            </button>

                          </div>
                        ) : leave.status === "Pending" ? (
                          <span className="text-gray-400 text-[10px]">
                            Awaiting approval
                          </span>
                        ) : leave.status === "Approved" ? (
                          <span className="text-green-600 font-semibold text-[10px]">
                            Approved
                          </span>
                        ) : (
                          <span className="text-red-600 font-semibold text-[10px]">
                            Rejected
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="10"
                    className="py-10 text-gray-500 text-sm"
                  >
                    No matching leave requests found
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

export default LeaveList;