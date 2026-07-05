import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "../api/auth";

// Centralizes the auth-token check that used to be duplicated in
// Lists.jsx/List.jsx/Stats.jsx/ShareTarget.jsx (and missing entirely from
// Settings.jsx) — wraps every route that needs a session, so each page
// component no longer has to guard itself.
const ProtectedLayout = () => {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return <Outlet />;
};

export default ProtectedLayout;
