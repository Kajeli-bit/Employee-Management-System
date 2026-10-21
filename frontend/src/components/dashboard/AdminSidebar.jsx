import { NavLink } from "react-router-dom";
import {
  FaBuilding,
  FaCalendar,
  FaClock,
  FaCogs,
  FaMapMarkedAlt,
  FaMoneyBillWave,
  FaPlus,
  FaSignOutAlt,
  FaSitemap,
  FaTachometerAlt,
  FaUsers,
} from "react-icons/fa";

import { useAuth } from "../../context/useAuth";
import {
  CAPABILITIES,
  hasCapability,
  roleLabel,
  roleLevel,
} from "../../utils/roles";

const menuClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
    isActive
      ? "bg-brand-600 text-white"
      : "text-slate-300 hover:bg-slate-800 hover:text-white"
  }`;

const GroupLabel = ({ children }) => (
  <p className="mt-5 mb-1.5 px-3 text-[11px] font-medium text-slate-500">
    {children}
  </p>
);

const AdminSidebar = () => {
  const { user, logout } = useAuth();
  const role = user?.role;

  const can = (capability) => hasCapability(role, capability);

  const showEmployees = can(CAPABILITIES.PEOPLE_VIEW);
  const showAddEmployee = can(CAPABILITIES.PEOPLE_MANAGE);
  const showDepartments = can(CAPABILITIES.DEPARTMENTS_VIEW);
  const showLeave = can(CAPABILITIES.LEAVES_APPROVE) || can(CAPABILITIES.LEAVES_VIEW);
  const showApplyLeave = can(CAPABILITIES.LEAVES_APPLY);
  const showSalary = can(CAPABILITIES.SALARIES_MANAGE) || can(CAPABILITIES.SALARIES_VIEW);
  const showAttendance = can(CAPABILITIES.ATTENDANCE_VIEW);
  const showLocations = can(CAPABILITIES.LOCATIONS_MANAGE);

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-900 text-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-600 text-sm font-bold">
          N
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Nilric</p>
          <p className="truncate text-[11px] text-slate-400">
            General Traders
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <GroupLabel>Overview</GroupLabel>

        <NavLink to="/admin-dashboard" end className={menuClass}>
          <FaTachometerAlt />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/admin-dashboard/organisation" className={menuClass}>
          <FaSitemap />
          <span>Organisation</span>
        </NavLink>

        {showDepartments && (
          <NavLink to="/admin-dashboard/departments" className={menuClass}>
            <FaBuilding />
            <span>Departments</span>
          </NavLink>
        )}

        <GroupLabel>People</GroupLabel>

        {showEmployees && (
          <NavLink to="/admin-dashboard/employees" className={menuClass}>
            <FaUsers />
            <span>Employees</span>
          </NavLink>
        )}

        {showAddEmployee && (
          <NavLink to="/admin-dashboard/add-employee" className={menuClass}>
            <FaPlus />
            <span>Add employee</span>
          </NavLink>
        )}

        {showLeave && (
          <NavLink to="/admin-dashboard/leave" className={menuClass}>
            <FaCalendar />
            <span>Leave requests</span>
          </NavLink>
        )}

        {showApplyLeave && (
          <NavLink to="/admin-dashboard/apply-leave" className={menuClass}>
            <FaCalendar />
            <span>Apply for leave</span>
          </NavLink>
        )}

        <GroupLabel>Operations</GroupLabel>

        <NavLink to="/admin-dashboard/my-attendance" className={menuClass}>
          <FaClock />
          <span>My attendance</span>
        </NavLink>

        {showAttendance && (
          <NavLink to="/admin-dashboard/attendance" className={menuClass}>
            <FaClock />
            <span>Team attendance</span>
          </NavLink>
        )}

        {showLocations && (
          <NavLink to="/admin-dashboard/work-locations" className={menuClass}>
            <FaMapMarkedAlt />
            <span>Work locations</span>
          </NavLink>
        )}

        {showSalary && (
          <NavLink to="/admin-dashboard/salary" className={menuClass}>
            <FaMoneyBillWave />
            <span>Salary</span>
          </NavLink>
        )}

        <GroupLabel>Company</GroupLabel>

        <NavLink to="/admin-dashboard/settings" className={menuClass}>
          <FaCogs />
          <span>Settings</span>
        </NavLink>
      </nav>

      <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-[11px] text-slate-400">
            {roleLabel(role)} · L{roleLevel(role)}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
          className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          <FaSignOutAlt />
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
