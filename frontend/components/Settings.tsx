import React, { useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { useLiveQuery } from "dexie-react-hooks";
import { registerSW } from "virtual:pwa-register";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Switch from "@mui/material/Switch";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CheckIcon from "@mui/icons-material/Check";
import { useSettings, SORT_OPTIONS } from "../appSettings";
import { DEFAULT_SEED_COLOR } from "../theme/m3Colors";
import { changePassword } from "../api/auth";
import db from "../db";
import pkg from "../package.json";
import Categories from "./Categories";
import Areas from "./Areas";

const ACCENT_PRESETS = [
  { label: "Green", value: DEFAULT_SEED_COLOR },
  { label: "Blue", value: "#2E5FD7" },
  { label: "Purple", value: "#6E4EBE" },
  { label: "Orange", value: "#C2670A" },
  { label: "Pink", value: "#B5457A" },
  { label: "Teal", value: "#1A7A72" },
];

const formatBytes = (bytes?: number) => {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`;
};

const Settings = () => {
  const [activeTab, setActiveTab] = useState<"general" | "categories" | "area">("general");
  const [settings, setSettings] = useSettings();
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null);
  const [swStatus, setSwStatus] = useState("unsupported");
  const [swRegistering, setSwRegistering] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const areas = useLiveQuery(() => db.areas.toArray()) || [];
  const pendingSyncCount = useLiveQuery(() => db.outbox.count()) || 0;

  const checkSwStatus = () => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration().then((reg) => {
      setSwStatus(reg?.active ? "active" : "not registered");
    });
  };

  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(setStorageEstimate);
    }
    checkSwStatus();
  }, []);

  const handleRegisterSW = async () => {
    if (!("serviceWorker" in navigator)) return;
    setSwRegistering(true);
    try {
      registerSW({ immediate: true });
      await navigator.serviceWorker.ready;
    } catch {
      // fall through to re-checking status below either way
    } finally {
      checkSwStatus();
      setSwRegistering(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setPasswordError(typeof detail === "string" ? detail : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const row = (primary: ReactNode, secondary: ReactNode, control: ReactNode) => (
    <ListItem secondaryAction={control}>
      <ListItemText primary={primary} secondary={secondary} />
    </ListItem>
  );

  return (
    <Box component="main">
      <Typography component="h1" variant="h4" gutterBottom sx={{ mb: 1 }}>
        Settings
      </Typography>

      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 2 }}>
        <Tab label="General" value="general" />
        <Tab label="Categories" value="categories" />
        <Tab label="Area" value="area" />
      </Tabs>

      {activeTab === "categories" && <Categories />}
      {activeTab === "area" && <Areas />}

      {activeTab === "general" && (
        <Box sx={{ maxWidth: 700 }}>
          <List
            subheader={
              <ListSubheader disableSticky sx={{ bgcolor: "transparent" }}>
                Account
              </ListSubheader>
            }
          >
            <ListItem>
              <ListItemText primary="Change password" />
            </ListItem>
            <ListItem>
              <Stack sx={{ gap: 1.5, width: "100%" }}>
                {passwordError && <Alert severity="error">{passwordError}</Alert>}
                {passwordSuccess && <Alert severity="success">Password changed.</Alert>}
                <TextField
                  label="Current password"
                  type="password"
                  size="small"
                  fullWidth
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <TextField
                  label="New password"
                  type="password"
                  size="small"
                  fullWidth
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  size="small"
                  fullWidth
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleChangePassword}
                    disabled={
                      changingPassword || !currentPassword || !newPassword || !confirmPassword
                    }
                  >
                    Change password
                  </Button>
                </Box>
              </Stack>
            </ListItem>
          </List>

          <List
            subheader={
              <ListSubheader disableSticky sx={{ bgcolor: "transparent" }}>
                Appearance
              </ListSubheader>
            }
          >
            {row(
              "Theme",
              "Follows your system by default",
              <Select
                size="small"
                value={settings.themeMode}
                onChange={(e) =>
                  setSettings({ themeMode: e.target.value as "system" | "light" | "dark" })
                }
              >
                <MenuItem value="system">System</MenuItem>
                <MenuItem value="light">Light</MenuItem>
                <MenuItem value="dark">Dark</MenuItem>
              </Select>
            )}
            <ListItem>
              <ListItemText
                primary="Accent color"
                secondary="Generates a full Material You palette from this seed"
              />
            </ListItem>
            <ListItem>
              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                {ACCENT_PRESETS.map((preset) => (
                  <ButtonBase
                    key={preset.value}
                    onClick={() => setSettings({ accentColor: preset.value })}
                    aria-label={preset.label}
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      bgcolor: preset.value,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: (theme) =>
                        settings.accentColor === preset.value
                          ? `2px solid ${theme.palette.text.primary}`
                          : "none",
                    }}
                  >
                    {settings.accentColor === preset.value && (
                      <CheckIcon sx={{ color: "white" }} fontSize="small" />
                    )}
                  </ButtonBase>
                ))}
              </Box>
            </ListItem>
            {row(
              "Compact mode",
              "Denser spacing throughout the app",
              <Switch
                checked={settings.compactMode}
                onChange={(e) => setSettings({ compactMode: e.target.checked })}
              />
            )}
            {row(
              "Animations",
              "Also respects your OS reduced-motion setting",
              <Switch
                checked={settings.animationsEnabled}
                onChange={(e) => setSettings({ animationsEnabled: e.target.checked })}
              />
            )}
          </List>

          <List
            subheader={
              <ListSubheader disableSticky sx={{ bgcolor: "transparent" }}>
                Shopping Lists
              </ListSubheader>
            }
          >
            {row(
              "Default sort",
              "Used when opening a list for the first time",
              <Select
                size="small"
                value={settings.defaultSort}
                onChange={(e) => setSettings({ defaultSort: e.target.value })}
              >
                {SORT_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            )}
            {row(
              "Default area",
              "Pre-selected when adding a new item",
              <Select
                size="small"
                displayEmpty
                value={settings.defaultAreaId || ""}
                onChange={(e) => setSettings({ defaultAreaId: e.target.value || null })}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="">None</MenuItem>
                {areas.map((area) => (
                  <MenuItem key={area.id} value={area.id}>
                    {area.area_name}
                  </MenuItem>
                ))}
              </Select>
            )}
          </List>

          <List
            subheader={
              <ListSubheader disableSticky sx={{ bgcolor: "transparent" }}>
                Offline & Sync
              </ListSubheader>
            }
          >
            {row(
              "Pending changes",
              pendingSyncCount > 0 ? "Will sync automatically when online" : "Everything is synced",
              pendingSyncCount
            )}
            {row(
              "Service worker",
              swStatus === "not registered" ? "Powers offline access and the install prompt" : null,
              swStatus === "not registered" ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleRegisterSW}
                  disabled={swRegistering}
                >
                  {swRegistering ? "Registering…" : "Register"}
                </Button>
              ) : (
                swStatus
              )
            )}
            {row(
              "Storage used",
              storageEstimate?.quota ? `of ${formatBytes(storageEstimate.quota)} available` : null,
              storageEstimate ? formatBytes(storageEstimate.usage) : "—"
            )}
          </List>

          <List
            subheader={
              <ListSubheader disableSticky sx={{ bgcolor: "transparent" }}>
                About
              </ListSubheader>
            }
          >
            {row("Version", null, pkg.version)}
          </List>
        </Box>
      )}
    </Box>
  );
};

export default Settings;
