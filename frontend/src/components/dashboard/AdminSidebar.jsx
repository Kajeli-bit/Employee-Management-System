import { NavLink } from "react-router-dom";
import {
  FaBuilding,
  FaCalendar,
  FaClock,
  FaMapMarkedAlt,
  FaMoneyBillWave,
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
import DrawerShell from "../ui/DrawerShell";

const menuClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? "bg-brand-700 text-white shadow-sm"
      : "text-brand-950/70 hover:bg-brand-100 hover:text-brand-950"
  }`;

const GroupLabel = ({ children }) => (
  <p className="mt-5 mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-brand-950/45">
    {children}
  </p>
);

const AdminSidebar = () => {
  const { user, logout } = useAuth();
  const role = user?.role;

  const can = (capability) => hasCapability(role, capability);

  const showEmployees = can(CAPABILITIES.PEOPLE_VIEW);
  const showDepartments = can(CAPABILITIES.DEPARTMENTS_VIEW);
  const showLeave = can(CAPABILITIES.LEAVES_APPROVE) || can(CAPABILITIES.LEAVES_VIEW);
  const showApplyLeave = can(CAPABILITIES.LEAVES_APPLY);
  const showSalary = can(CAPABILITIES.SALARIES_MANAGE) || can(CAPABILITIES.SALARIES_VIEW);
  const showAttendance = can(CAPABILITIES.ATTENDANCE_VIEW);
  const showLocations = can(CAPABILITIES.LOCATIONS_MANAGE);

  return (
    <DrawerShell onLogout={logout} user={user} roleFooter={`${roleLabel(role)} · L${roleLevel(role)}`}>
      <div className="flex h-16 shrink-0 items-center border-b border-brand-950/10 bg-white px-4">
        <img
          src="/nilric-logo.png"
          alt="Nilric General Traders"
          className="h-9 w-auto"
        />
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

      </nav>

      <div className="hidden items-center justify-between gap-3 border-t border-brand-950/10 px-4 py-3 lg:flex">
        <NavLink
          to="/admin-dashboard/account"
          title="My account: worker profile and settings"
          className="min-w-0 flex-1 rounded-lg px-1 py-1 transition hover:bg-brand-100"
        >
          <p className="truncate text-sm font-semibold text-brand-950">{user?.name}</p>
          <p className="truncate text-[11px] text-brand-950/55">
            {roleLabel(role)} · L{roleLevel(role)}
          </p>
        </NavLink>
        <button
          type="button"
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
          className="shrink-0 rounded-lg p-2 text-brand-950/50 transition hover:bg-brand-100 hover:text-brand-950"
        >
          <FaSignOutAlt />
        </button>
      </div>
    </DrawerShell>
  );
};

export default AdminSidebar;
