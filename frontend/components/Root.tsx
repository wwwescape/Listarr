import React from "react";
import { Outlet } from "react-router-dom";
import InstallPrompt from "./InstallPrompt";

// Pathless root layout — every route (public and protected) nests under
// this, so InstallPrompt stays mounted for the app's entire lifetime
// (its beforeinstallprompt listener must never miss the event, which only
// fires once per page load) and its banner shows on every page.
const Root = () => (
  <>
    <Outlet />
    <InstallPrompt />
  </>
);

export default Root;
