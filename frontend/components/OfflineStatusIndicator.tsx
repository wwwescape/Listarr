import React, { useEffect, useState } from "react";
import Chip from "@mui/material/Chip";
import CloudOffIcon from "@mui/icons-material/CloudOff";

// The navigator.onLine + online/offline listener pattern used to be
// duplicated per-page (Lists.jsx, List.jsx) — now that there's a persistent
// AppBar visible on every screen, one shared indicator there covers it.
const OfflineStatusIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (isOnline) return null;
  return <Chip size="small" icon={<CloudOffIcon />} label="Offline" />;
};

export default OfflineStatusIndicator;
