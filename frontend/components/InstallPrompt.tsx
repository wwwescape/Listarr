import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";

// `beforeinstallprompt` isn't in lib.dom's standard Event types (a
// non-standard PWA-install API not universally supported) — typed narrowly
// here rather than reaching for `any`.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "installPromptDismissed";
const INSTALLED_KEY = "installPromptInstalled";

// iOS Safari exposes navigator.standalone instead of the display-mode media
// query; neither is in lib.dom's standard types.
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

// Browsers only fire beforeinstallprompt once per page load, and only when
// their own install-eligibility heuristics are met (manifest + service
// worker + engagement) — this captures that event so we can trigger the
// native prompt from our own button instead of waiting for a browser-chrome
// icon. The listener has to stay mounted for the app's whole lifetime (not
// just while on the lists screen) since a client-side route change away and
// back would otherwise miss an event that already fired. The visible UI is
// shown app-wide (not scoped to a single route): dismissal is stored in
// sessionStorage so it reappears on the next login/session rather than
// being suppressed forever, and Login.tsx clears that flag on a successful
// login for the same reason.
const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(sessionStorage.getItem(DISMISS_KEY) === "true");
  const [installed, setInstalled] = useState(isStandalone() || localStorage.getItem(INSTALLED_KEY) === "true");

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "true");
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "true");
  };

  if (!deferredPrompt || dismissed || installed) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 420,
        mx: "auto",
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: "background.paper",
        p: 1.5,
        borderRadius: 3,
        boxShadow: 4,
        zIndex: (theme) => theme.zIndex.snackbar,
      }}
    >
      <Typography variant="body2" sx={{ flexGrow: 1 }}>
        Install this app for quick, offline access.
      </Typography>
      <Button size="small" variant="contained" onClick={handleInstall}>
        Install
      </Button>
      <IconButton size="small" onClick={handleDismiss} aria-label="dismiss install prompt">
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default InstallPrompt;
