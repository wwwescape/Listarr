import React, { type ReactNode } from "react";
import ListAltIcon from "@mui/icons-material/ListAlt";
import CorporateFareIcon from "@mui/icons-material/CorporateFare";
import GroupIcon from "@mui/icons-material/Group";
import BarChartIcon from "@mui/icons-material/BarChart";
import SettingsIcon from "@mui/icons-material/Settings";

export interface Destination {
  to: string;
  label: string;
  icon: ReactNode;
}

// Single source of truth for the nav — consumed by NavRail, NavDrawer, and
// BottomNavBar so all three responsive renderers stay in sync automatically.
// Flat on purpose: none of these five destinations has natural sub-pages —
// Categories/Areas live as tabs inside the Settings page instead.
const destinations: Destination[] = [
  { to: "/lists", label: "Lists", icon: <ListAltIcon /> },
  { to: "/homes", label: "Homes", icon: <CorporateFareIcon /> },
  { to: "/users", label: "Users", icon: <GroupIcon /> },
  { to: "/stats", label: "Stats", icon: <BarChartIcon /> },
  { to: "/settings", label: "Settings", icon: <SettingsIcon /> },
];

export default destinations;
