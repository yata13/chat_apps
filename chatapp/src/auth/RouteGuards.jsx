// src/auth/RouteGuards.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./authContext.jsx";

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" />;
  return children;
}


export function PublicOnly({ children }) {
  const { ready, user } = useAuth();
  if (!ready) return null;
  if (user) return <Navigate to="/chatdashbord" replace />;
  return children;
}
