import { NavLink } from "react-router-dom";
import {
  FaClipboardList,
  FaClock,
  FaCogs,
  FaSignOutAlt,
  FaSitemap,
  FaTachometerAlt,
  FaUsers,
} from "react-icons/fa";
import DrawerShell from "../ui/DrawerShell";
import { useAuth } from "../../context/useAuth";
import { isManagementRole, roleLabel, roleLevel } from "../../utils/roles";

const menuClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? "bg-brand-700 text-white shadow-sm"
      : "text-brand-950/70 hover:bg-brand-100 hover:text-brand-950"
  }`;

const Sidebar = () => {
  const { user, logout } = useAuth();

  return (
    <DrawerShell
      onLogout={logout}
      user={user}
      roleFooter={`${roleLabel(user?.role)} · L${roleLevel(user?.role)}`}
      accountHref="/employee-dashboard/settings"
    >
      <div className="flex h-16 shrink-0 items-center border-b border-brand-950/10 bg-white px-4">
        <img
          src="/nilric-logo.png"
          alt="Nilric General Traders"
          className="h-9 w-auto"
        />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavLink to="/employee-dashboard" end className={menuClass}>
          <FaTachometerAlt size={16} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/employee-dashboard/attendance" className={menuClass}>
          <FaClock size={16} />
          <span>My attendance</span>
        </NavLink>

        <NavLink to="/employee-dashboard/my-leaves" className={menuClass}>
          <FaClipboardList size={16} />
          <span>My leaves</span>
        </NavLink>

        <NavLink to="/employee-dashboard/organisation" className={menuClass}>
          <FaSitemap size={16} />
          <span>Organisation</span>
        </NavLink>

        <NavLink to="/employee-dashboard/settings" className={menuClass}>
          <FaCogs size={16} />
          <span>Settings</span>
        </NavLink>

        {/* MD and HR can use both workspaces. */}
        {isManagementRole(user?.role) && (
          <>
            <p className="mt-5 mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-brand-950/45">
              Management
            </p>
            <NavLink to="/admin-dashboard" className={menuClass}>
              <FaUsers size={16} />
              <span>Management console</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="hidden items-center justify-between gap-3 border-t border-brand-950/10 bg-white px-4 py-3 lg:flex">
        <NavLink
          to="/employee-dashboard/settings"
          title="Login and security — change your sign-in email"
          className="min-w-0 flex-1 rounded-lg px-1 py-1 transition hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <p className="truncate text-sm font-semibold text-brand-950">
            {user?.name || "Signed in"}
          </p>
          <p className="truncate text-[11px] text-brand-950/55">
            {roleLabel(user?.role)} · L{roleLevel(user?.role)}
          </p>
        </NavLink>
        <button
          type="button"
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
          className="shrink-0 rounded-lg p-2 text-brand-950/50 transition hover:bg-brand-100 hover:text-brand-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <FaSignOutAlt aria-hidden="true" />
        </button>
      </div>
    </DrawerShell>
  );
};

export default Sidebar;
