import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Paper from "@mui/material/Paper";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import destinations from "./destinations";

export const BOTTOM_NAV_HEIGHT = 64;

// Fixed bottom nav for phone-width screens (<600px).
const BottomNavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const current = destinations.find((d) => location.pathname.startsWith(d.to))?.to || false;

  return (
    <Paper
      elevation={8}
      sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar }}
    >
      <BottomNavigation
        value={current}
        onChange={(event, value) => navigate(value)}
        sx={{ height: BOTTOM_NAV_HEIGHT }}
      >
        {destinations.map((dest) => (
          <BottomNavigationAction key={dest.to} label={dest.label} value={dest.to} icon={dest.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default BottomNavBar;
