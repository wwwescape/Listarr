import React, { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import LogoutIcon from "@mui/icons-material/Logout";
import NavRail, { NAV_RAIL_WIDTH } from "./navigation/NavRail";
import NavDrawer, { NAV_DRAWER_WIDTH } from "./navigation/NavDrawer";
import BottomNavBar, { BOTTOM_NAV_HEIGHT } from "./navigation/BottomNavBar";
import Breadcrumbs from "./navigation/Breadcrumbs";
import OfflineStatusIndicator from "./components/OfflineStatusIndicator";
import { useSettings } from "./appSettings";
import { fetchCurrentUser } from "./sync";
import { logout } from "./api/auth";

const AppShell = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [settings, setSettings] = useSettings();
  const isCompact = useMediaQuery(theme.breakpoints.down("sm"));
  const isExpanded = useMediaQuery(theme.breakpoints.up("lg"));

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      navigate("/login");
    }
  };

  const toggleDarkMode = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ themeMode: event.target.checked ? "dark" : "light" });
  };

  const sideNavWidth = isCompact ? 0 : isExpanded ? NAV_DRAWER_WIDTH : NAV_RAIL_WIDTH;

  return (
    <Box sx={{ display: "flex" }}>
      {/* Always full-width and un-offset by the side nav — the nav itself is
          pushed below this bar (see NavRail/NavDrawer's own top offset)
          rather than the bar being squeezed to sit beside it. */}
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          <Box component="img" src="/Listarr.png" alt="" sx={{ height: 44, width: 44 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Listarr
          </Typography>
          <OfflineStatusIndicator />
          <Switch checked={settings.themeMode === "dark"} onChange={toggleDarkMode} aria-label="dark mode" />
          <IconButton color="inherit" onClick={handleLogout} aria-label="log out">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {!isCompact && (isExpanded ? <NavDrawer /> : <NavRail />)}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { sm: `calc(100% - ${sideNavWidth}px)` },
          p: { xs: 1.5, sm: 2, md: 3 },
          pb: isCompact ? `${BOTTOM_NAV_HEIGHT + 24}px` : undefined,
        }}
      >
        <Toolbar />
        <Breadcrumbs />
        <Outlet />
      </Box>

      {isCompact && <BottomNavBar />}
    </Box>
  );
};

export default AppShell;
