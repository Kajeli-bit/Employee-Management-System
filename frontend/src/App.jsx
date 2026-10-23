import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";

import PrivateRoutes from "./utils/PrivateRoutes";
import RoleBaseRoutes from "./utils/RoleBaseRoutes";

// Dashboard
import AdminSummary from "./components/dashboard/AdminSummary";

// Department
import DepartmentList from "./components/departments/DeparmentList";
import AddDepartment from "./components/departments/AddDepartment";
import ViewDepartment from "./components/departments/ViewDepartment";

// Employee
import List from "./components/employee/List";
import Add from "./components/employee/Add";
import View from "./components/employee/View";
import Edit from "./components/employee/Edit";

// Leave
import LeaveList from "./components/leave/LeaveList";
import EmployeeLeave from "./components/leave/EmployeeLeave";

// IMPORTANT:
// Same ApplyLeave component is used by management
// and normal employees.
import ApplyLeave from "./components/EmployeeDashboard/ApplyLeave";

// Salary
import SalaryList from "./components/salary/List";
import AddSalary from "./components/salary/AddSalary";
import EditSalary from "./components/salary/EditSalary";
import SalaryHistory from "./components/salary/SalaryHistory";

// Admin Settings
import Settings from "./components/settings/Settings";

// Attendance
import AttendanceRegister from "./components/attendance/AttendanceRegister";
import WorkLocations from "./components/attendance/WorkLocations";
import MyAttendance from "./components/attendance/MyAttendance";

// Organisation
import OrgChart from "./components/org/OrgChart";

// Employee Dashboard
import EmployeeSummary from "./components/EmployeeDashboard/EmployeeSummary";
import MyLeaves from "./components/EmployeeDashboard/MyLeaves";
import EditLeave from "./components/EmployeeDashboard/EditLeave";
import Setting from "./components/EmployeeDashboard/Setting";

function App() {
  return (
    <BrowserRouter>
      <Routes>

       

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

        

        <Route
          path="/login/*"
          element={<Login />}
        />

        

        <Route
          path="/unauthorized"
          element={
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
              <div className="bg-white p-8 rounded-lg shadow-md text-center">

                <h1 className="text-2xl font-bold text-red-600 mb-2">
                  Unauthorized Access
                </h1>

                <p className="text-gray-600">
                  You do not have permission to access this page.
                </p>

                <button
                  onClick={() =>
                    window.history.back()
                  }
                  className="
                    mt-5
                    px-4
                    py-2
                    bg-blue-600
                    text-white
                    rounded
                    hover:bg-blue-700
                  "
                >
                  Go Back
                </button>

              </div>
            </div>
          }
        />

        

        <Route
          path="/admin-dashboard"
          element={
            <PrivateRoutes>
              <RoleBaseRoutes access="management">
                <AdminDashboard />
              </RoleBaseRoutes>
            </PrivateRoutes>
          }
        >

          {/* Dashboard */}

          <Route
            index
            element={<AdminSummary />}
          />

          

          <Route
            path="attendance"
            element={<AttendanceRegister />}
          />

          {/* My workspace: the signed-in manager's own records, inside the
              console so they never have to switch portals. */}

          <Route
            path="my"
            element={<EmployeeSummary />}
          />

          <Route
            path="my/attendance"
            element={<MyAttendance />}
          />

          <Route
            path="my/leaves"
            element={<MyLeaves />}
          />

          <Route
            path="my/leaves/:id/edit"
            element={<EditLeave />}
          />

          <Route
            path="my/apply-leave"
            element={<ApplyLeave />}
          />

          {/* The salary, profile and account pages were removed; old URLs land
              on the workspace dashboard rather than a blank screen. */}

          <Route
            path="my/salary"
            element={<Navigate to="/admin-dashboard/my" replace />}
          />

          <Route
            path="my/profile"
            element={<Navigate to="/admin-dashboard/my" replace />}
          />

          {/* Older links to the two pages that used to sit at the top level. */}

          <Route
            path="my-attendance"
            element={<Navigate to="/admin-dashboard/my/attendance" replace />}
          />

          <Route
            path="work-locations"
            element={<WorkLocations />}
          />

          <Route
            path="organisation"
            element={<OrgChart />}
          />

          <Route
            path="departments"
            element={<DepartmentList />}
          />

          <Route
            path="add-department"
            element={<AddDepartment />}
          />

          <Route
            path="departments/view/:id"
            element={<ViewDepartment />}
          />

          

          <Route
            path="employees"
            element={<List />}
          />

          <Route
            path="add-employee"
            element={<Add />}
          />

          <Route
            path="employee/:id"
            element={<View />}
          />

          <Route
            path="employees/edit/:id"
            element={<Edit />}
          />

          

          <Route
            path="salary"
            element={<SalaryList />}
          />

          <Route
            path="salary/add"
            element={<AddSalary />}
          />

          <Route
            path="salary/edit/:id"
            element={<EditSalary />}
          />

          <Route
            path="salary-history/:id"
            element={<SalaryHistory />}
          />

          
          <Route
            path="leave"
            element={<LeaveList />}
          />

          <Route
            path="employee-leaves/:id"
            element={<EmployeeLeave />}
          />

          

          <Route
            path="apply-leave"
            element={<Navigate to="/admin-dashboard/my/apply-leave" replace />}
          />

          

          <Route
            path="settings"
            element={<Settings />}
          />

          <Route
            path="account"
            element={<Navigate to="/admin-dashboard/my" replace />}
          />

        </Route>

        

        <Route
          path="/employee-dashboard"
          element={
            <PrivateRoutes>
              <RoleBaseRoutes access="self">
                <EmployeeDashboard />
              </RoleBaseRoutes>
            </PrivateRoutes>
          }
        >

          {/* Dashboard */}

          <Route
            index
            element={<EmployeeSummary />}
          />

          {/* Attendance */}

          <Route
            path="attendance"
            element={<MyAttendance />}
          />

          {/* Organisation */}

          <Route
            path="organisation"
            element={<OrgChart />}
          />

          {/* Apply Leave */}

          <Route
            path="apply-leave"
            element={<ApplyLeave />}
          />

          {/* Removed pages: send old links to the dashboard. */}

          <Route
            path="salary"
            element={<Navigate to="/employee-dashboard" replace />}
          />

          <Route
            path="profile"
            element={<Navigate to="/employee-dashboard" replace />}
          />

          {/* My Leaves */}

          <Route
            path="my-leaves"
            element={<MyLeaves />}
          />

          {/* Edit Leave */}

          <Route
            path="edit-leave/:id"
            element={<EditLeave />}
          />

          {/* Settings */}

          <Route
            path="settings"
            element={<Setting />}
          />

        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;