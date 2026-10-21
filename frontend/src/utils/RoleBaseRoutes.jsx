import { Navigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { isManagementRole } from "./roles";

const Loading = () => (
  <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
    Loading your workspace…
  </div>
);

// access="management" allows team leads and above.
// access="self" is the employee portal for everyone below team lead.
const RoleBaseRoutes = ({ children, access, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !requiredRole.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (access === "management" && !isManagementRole(user.role)) {
    return <Navigate to="/employee-dashboard" replace />;
  }

  if (access === "self" && isManagementRole(user.role)) {
    return <Navigate to="/admin-dashboard" replace />;
  }

  return children;
};

export default RoleBaseRoutes;
