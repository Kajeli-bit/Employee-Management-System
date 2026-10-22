import { useAuth } from "../context/useAuth";
import { Navigate } from "react-router-dom";
import Loader from "../components/common/Loader";

const PrivateRoutes = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader label="Loading your workspace…" fullScreen />;
  }

  return user ? children : <Navigate to="/login" replace />;
};

export default PrivateRoutes;