import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import destinations from "./destinations";

export const NAV_DRAWER_WIDTH = 240;
const APP_BAR_HEIGHT = 64;

// Full labeled permanent drawer for desktop-width screens (>=1200px). Sits
// below the always-full-width AppBar via an explicit top offset on its own
// paper, rather than the AppBar making room for it.
const NavDrawer = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: NAV_DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: NAV_DRAWER_WIDTH,
          boxSizing: "border-box",
          border: "none",
          top: APP_BAR_HEIGHT,
          height: `calc(100% - ${APP_BAR_HEIGHT}px)`,
        },
      }}
    >
      <List component="nav" aria-label="Primary" sx={{ px: 1.5 }}>
        {destinations.map((dest) => {
          const selected = location.pathname.startsWith(dest.to);
          return (
            <ListItem key={dest.to} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={selected}
                onClick={() => navigate(dest.to)}
                aria-current={selected ? "page" : undefined}
                sx={{ borderRadius: 999 }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: selected ? "primary.main" : "inherit" }}>
                  {dest.icon}
                </ListItemIcon>
                <ListItemText primary={dest.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Drawer>
  );
};

export default NavDrawer;
