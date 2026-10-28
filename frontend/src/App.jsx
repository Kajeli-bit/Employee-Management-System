import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import PrivateRoutes from "./utils/PrivateRoutes";
import RoleBaseRoutes from "./utils/RoleBaseRoutes";
import Loader from "./components/common/Loader";
import PwaInstallPrompt from "./components/common/PwaInstallPrompt";

const Login = lazy(() => import("./pages/Login"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const AdminSummary = lazy(() => import("./components/dashboard/AdminSummary"));
const DepartmentList = lazy(() => import("./components/departments/DeparmentList"));
const AddDepartment = lazy(() => import("./components/departments/AddDepartment"));
const ViewDepartment = lazy(() => import("./components/departments/ViewDepartment"));
const List = lazy(() => import("./components/employee/List"));
const Add = lazy(() => import("./components/employee/Add"));
const View = lazy(() => import("./components/employee/View"));
const Edit = lazy(() => import("./components/employee/Edit"));
const LeaveList = lazy(() => import("./components/leave/LeaveList"));
const EmployeeLeave = lazy(() => import("./components/leave/EmployeeLeave"));
const ApplyLeave = lazy(() => import("./components/EmployeeDashboard/ApplyLeave"));
const SalaryList = lazy(() => import("./components/salary/List"));
const AddSalary = lazy(() => import("./components/salary/AddSalary"));
const EditSalary = lazy(() => import("./components/salary/EditSalary"));
const SalaryHistory = lazy(() => import("./components/salary/SalaryHistory"));
const Settings = lazy(() => import("./components/settings/Settings"));
const AttendanceRegister = lazy(() => import("./components/attendance/AttendanceRegister"));
const WorkLocations = lazy(() => import("./components/attendance/WorkLocations"));
const MyAttendance = lazy(() => import("./components/attendance/MyAttendance"));
const OrgChart = lazy(() => import("./components/org/OrgChart"));
const EmployeeSummary = lazy(() => import("./components/EmployeeDashboard/EmployeeSummary"));
const AttendanceHeartbeat = lazy(() => import("./components/attendance/AttendanceHeartbeat"));
const MyLeaves = lazy(() => import("./components/EmployeeDashboard/MyLeaves"));
const EditLeave = lazy(() => import("./components/EmployeeDashboard/EditLeave"));
const Setting = lazy(() => import("./components/EmployeeDashboard/Setting"));
const SecurityCenter = lazy(() => import("./components/security/SecurityCenter"));

function App() {
  return (
    <BrowserRouter>
      <PwaInstallPrompt />
      <Suspense fallback={<Loader label="Opening your workspace…" fullScreen />}>
        <AttendanceHeartbeat />
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
          path="/super-user"
          element={
            <PrivateRoutes>
              <RoleBaseRoutes access="super-user">
                <Navigate to="/admin-dashboard/security" replace />
              </RoleBaseRoutes>
            </PrivateRoutes>
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

          <Route index element={<AdminSummary />} />
          <Route
            path="security"
            element={
              <RoleBaseRoutes access="security-oversight">
                <SecurityCenter />
              </RoleBaseRoutes>
            }
          />

          {/* Dashboard */}


          

          <Route
            path="attendance"
            element={<AttendanceRegister />}
          />

          {/* My workspace: the signed-in manager's own records, inside the
              console so they never have to switch portals. */}

          <Route
            path="my"
            element={<RoleBaseRoutes access="employee-workspace"><EmployeeSummary /></RoleBaseRoutes>}
          />

          <Route
            path="my/attendance"
            element={<RoleBaseRoutes access="employee-workspace"><MyAttendance /></RoleBaseRoutes>}
          />

          <Route
            path="my/leaves"
            element={<RoleBaseRoutes access="employee-workspace"><MyLeaves /></RoleBaseRoutes>}
          />

          <Route
            path="my/leaves/:id/edit"
            element={<RoleBaseRoutes access="employee-workspace"><EditLeave /></RoleBaseRoutes>}
          />

          <Route
            path="my/apply-leave"
            element={<RoleBaseRoutes access="employee-workspace"><ApplyLeave /></RoleBaseRoutes>}
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;