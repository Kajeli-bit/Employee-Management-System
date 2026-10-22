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
import DrawerShell from "../ui/DrawerShell";

const menuClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? "bg-brand-700 text-white shadow-sm"
      : "text-brand-950/70 hover:bg-brand-100 hover:text-brand-950"
  }`;

const Sidebar = () => {
  return (
    <DrawerShell>
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
    </DrawerShell>
  );
};

export default Sidebar;
