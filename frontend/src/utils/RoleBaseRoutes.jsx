import { Navigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import Loader from "../components/common/Loader";
import { isManagementUser, isSuperUser } from "./roles";

// access="management" is the Managing Director / HR console.
// access="self" is the worker portal, open to every signed-in account — MD and
// HR are allowed to use both workspaces.
const RoleBaseRoutes = ({ children, access, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader label="Opening your workspace…" fullScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !requiredRole.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (access === "management" && (!isManagementUser(user) || isSuperUser(user))) {
    return <Navigate to={isSuperUser(user) ? "/super-user" : "/employee-dashboard"} replace />;
  }

  if (access === "self" && isSuperUser(user)) {
    return <Navigate to="/super-user" replace />;
  }

  if (access === "super-user" && !isSuperUser(user)) {
    return <Navigate to={isManagementUser(user) ? "/admin-dashboard" : "/employee-dashboard"} replace />;
  }

  if (access === "security-oversight" && !isSuperUser(user) && user.securityOversight !== true) {
    return <Navigate to={isManagementUser(user) ? "/admin-dashboard" : "/employee-dashboard"} replace />;
  }

  return children;
};

export default RoleBaseRoutes;
