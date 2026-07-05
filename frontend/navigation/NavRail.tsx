import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import destinations from "./destinations";

export const NAV_RAIL_WIDTH = 80;
const APP_BAR_HEIGHT = 64;

// Icon-only permanent drawer for tablet-width screens (600px–1199px) — the
// M3 nav-rail spec puts the "selected" indicator as a small pill behind
// just the icon, with the caption label sitting unstyled below it, rather
// than one pill wrapping icon+label together.
const NavRail = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: NAV_RAIL_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: NAV_RAIL_WIDTH,
          boxSizing: "border-box",
          border: "none",
          top: APP_BAR_HEIGHT,
          height: `calc(100% - ${APP_BAR_HEIGHT}px)`,
        },
      }}
    >
      <Box component="nav" aria-label="Primary" sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, pt: 2 }}>
        {destinations.map((dest) => {
          const selected = location.pathname.startsWith(dest.to);
          return (
            <Box
              key={dest.to}
              onClick={() => navigate(dest.to)}
              aria-current={selected ? "page" : undefined}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
                width: 56,
                py: 0.5,
                borderRadius: 2,
                cursor: "pointer",
                color: selected ? "primary.main" : "text.secondary",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 56,
                  height: 32,
                  borderRadius: 999,
                  bgcolor: selected ? "action.selected" : "transparent",
                }}
              >
                {dest.icon}
              </Box>
              <Typography variant="caption" sx={{ fontSize: "0.6875rem" }}>
                {dest.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Drawer>
  );
};

export default NavRail;
