import { NavLink } from "react-router-dom";
import {
  FaCalendarAlt,
  FaClipboardList,
  FaClock,
  FaCogs,
  FaMoneyBillWave,
  FaSitemap,
  FaTachometerAlt,
  FaUser,
} from "react-icons/fa";

const menuClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
    isActive
      ? "bg-brand-600 text-white"
      : "text-slate-300 hover:bg-slate-800 hover:text-white"
  }`;

const Sidebar = () => {
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-900 text-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-600 text-sm font-bold">
          N
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Nilric</p>
          <p className="truncate text-[11px] text-slate-400">Employee portal</p>
        </div>
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

        <NavLink to="/employee-dashboard/profile" className={menuClass}>
          <FaUser size={16} />
          <span>My profile</span>
        </NavLink>

        <NavLink to="/employee-dashboard/apply-leave" className={menuClass}>
          <FaCalendarAlt size={16} />
          <span>Apply for leave</span>
        </NavLink>

        <NavLink to="/employee-dashboard/my-leaves" className={menuClass}>
          <FaClipboardList size={16} />
          <span>My leaves</span>
        </NavLink>

        <NavLink to="/employee-dashboard/salary" className={menuClass}>
          <FaMoneyBillWave size={16} />
          <span>My salary</span>
        </NavLink>

        <NavLink to="/employee-dashboard/organisation" className={menuClass}>
          <FaSitemap size={16} />
          <span>Organisation</span>
        </NavLink>

        <NavLink to="/employee-dashboard/settings" className={menuClass}>
          <FaCogs size={16} />
          <span>Settings</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
