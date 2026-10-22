import AdminSidebar from "../components/dashboard/AdminSidebar";
import { Outlet } from "react-router-dom";

const AdminDashboard = () => {
  return (
    <div className="min-h-screen bg-brand-50/60">
      <AdminSidebar />

      <div className="pt-14 lg:ml-64 lg:pt-0">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminDashboard;