import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { checkAdminExists } from "../api/users";

// Rendered at "/" — a pure redirect to wherever the user actually belongs:
// /setup on a fresh install (no admin yet), /login otherwise (which itself
// redirects to /lists if already logged in). Kept outside AppShell, like
// Login/Setup, since none of these screens have anything to navigate to yet.
const Bootstrap = () => {
  const [adminUserSet, setAdminUserSet] = useState(!!localStorage.getItem("adminUser"));
  const [checked, setChecked] = useState(adminUserSet);

  useEffect(() => {
    if (adminUserSet) return;

    // The "adminUser" flag only lives in this browser's localStorage, so a
    // fresh profile/cleared storage looks identical to "no admin exists
    // yet" even when the server already has one. Ask the server directly
    // instead of trusting a local flag that can drift out of sync with it.
    checkAdminExists()
      .then((exists) => {
        if (exists) {
          localStorage.setItem("adminUser", "true");
          setAdminUserSet(true);
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [adminUserSet]);

  if (!checked) return null;
  return <Navigate to={adminUserSet ? "/login" : "/setup"} replace />;
};

export default Bootstrap;
