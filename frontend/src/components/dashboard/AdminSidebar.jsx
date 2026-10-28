import { NavLink } from "react-router-dom";
import {
  FaBuilding,
  FaCalendar,
  FaClock,
  FaClipboardList,
  FaMapMarkedAlt,
  FaSignOutAlt,
  FaShieldAlt,
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
  isSuperUser,
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
  const superUser = isSuperUser(user);
  const can = (capability) => !superUser && hasCapability(role, capability);
  const showEmployees = can(CAPABILITIES.PEOPLE_VIEW);
  const showDepartments = can(CAPABILITIES.DEPARTMENTS_VIEW);
  const showLeave = can(CAPABILITIES.LEAVES_APPROVE) || can(CAPABILITIES.LEAVES_VIEW);
  const showAttendance = can(CAPABILITIES.ATTENDANCE_VIEW);
  const showLocations = can(CAPABILITIES.LOCATIONS_MANAGE);

  if (superUser) {
    return (
      <DrawerShell onLogout={logout} user={user} roleFooter="Company Super User · Elevated access" accountHref="/admin-dashboard">
        <div className="flex h-16 shrink-0 items-center border-b border-brand-950/10 bg-white px-4">
          <img src="/nilric-logo.png" alt="Nilric General Traders" className="h-9 w-auto" />
        </div>
        <nav className="flex-1 px-3 pb-4" aria-label="Super-user navigation">
          <GroupLabel>Security</GroupLabel>
          <NavLink to="/super-user" end className={menuClass}>
            <FaClipboardList aria-hidden="true" />
            <span>Security &amp; recovery</span>
          </NavLink>
        </nav>
        <div className="hidden items-center justify-between gap-3 border-t border-brand-950/10 px-4 py-3 lg:flex">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-brand-950">{user?.name}</p>
            <p className="truncate text-[11px] text-brand-950/55">Company Super User</p>
          </div>
          <button type="button" onClick={logout} title="Sign out" aria-label="Sign out" className="shrink-0 rounded-lg p-2 text-brand-950/50 transition hover:bg-brand-100 hover:text-brand-950"><FaSignOutAlt /></button>
        </div>
      </DrawerShell>
    );
  }

  return (
    <DrawerShell
      onLogout={logout}
      user={user}
      roleFooter={`${roleLabel(role)} · L${roleLevel(role)}`}
      accountHref="/admin-dashboard/settings"
    >
      <div className="flex h-16 shrink-0 items-center border-b border-brand-950/10 bg-white px-4">
        <img src="/nilric-logo.png" alt="Nilric General Traders" className="h-9 w-auto" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <GroupLabel>Overview</GroupLabel>
        <NavLink to="/admin-dashboard" end className={menuClass}><FaTachometerAlt /><span>Dashboard</span></NavLink>
        {user?.securityOversight === true && <NavLink to="/admin-dashboard/security" className={menuClass}><FaShieldAlt /><span>Security &amp; recovery</span></NavLink>}
        <NavLink to="/admin-dashboard/organisation" className={menuClass}><FaSitemap /><span>Organisation</span></NavLink>
        {showDepartments && <NavLink to="/admin-dashboard/departments" className={menuClass}><FaBuilding /><span>Departments</span></NavLink>}
        <GroupLabel>People</GroupLabel>
        {showEmployees && <NavLink to="/admin-dashboard/employees" className={menuClass}><FaUsers /><span>Staff Management</span></NavLink>}
        {showLeave && <NavLink to="/admin-dashboard/leave" className={menuClass}><FaCalendar /><span>Leave requests</span></NavLink>}
        <GroupLabel>Operations</GroupLabel>
        {showAttendance && <NavLink to="/admin-dashboard/attendance" className={menuClass}><FaClock /><span>Team attendance</span></NavLink>}
        {showLocations && <NavLink to="/admin-dashboard/work-locations" className={menuClass}><FaMapMarkedAlt /><span>Work locations</span></NavLink>}
        <GroupLabel>My workspace</GroupLabel>
        <NavLink to="/admin-dashboard/my" end className={menuClass}><FaTachometerAlt /><span>My dashboard</span></NavLink>
        <NavLink to="/admin-dashboard/my/attendance" className={menuClass}><FaClock /><span>My attendance</span></NavLink>
        <NavLink to="/admin-dashboard/my/leaves" className={menuClass}><FaClipboardList /><span>My leaves</span></NavLink>
      </nav>
      <div className="hidden items-center justify-between gap-3 border-t border-brand-950/10 px-4 py-3 lg:flex">
        <NavLink to="/admin-dashboard/settings" title="Login and security — change your sign-in email" className="min-w-0 flex-1 rounded-lg px-1 py-1 transition hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
          <p className="truncate text-sm font-semibold text-brand-950">{user?.name}</p>
          <p className="truncate text-[11px] text-brand-950/55">{`${roleLabel(role)} · L${roleLevel(role)}`}</p>
        </NavLink>
        <button type="button" onClick={logout} title="Sign out" aria-label="Sign out" className="shrink-0 rounded-lg p-2 text-brand-950/50 transition hover:bg-brand-100 hover:text-brand-950"><FaSignOutAlt /></button>
      </div>
    </DrawerShell>
  );
};

export default AdminSidebar;
