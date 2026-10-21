import AdminSidebar from "../components/dashboard/AdminSidebar";
import { Outlet } from "react-router-dom";

const AdminDashboard = () => {
  return (
    <div className="flex">
      <AdminSidebar />

      <div className="flex-1 ml-64 bg-gray-100 min-h-screen">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminDashboard;