import { useMemo } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Theme } from "@mui/material/styles";
import { useSettings } from "../appSettings";
import { buildTheme } from "./createM3Theme";
import type { ColorMode } from "./m3Colors";

export function usePreferredMode(): ColorMode {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  return prefersDark ? "dark" : "light";
}

export function useAppTheme(): Theme {
  const systemMode = usePreferredMode();
  const prefersReducedMotionOS = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [settings] = useSettings();

  const mode = settings.themeMode === "system" ? systemMode : settings.themeMode;
  const reduceMotion = prefersReducedMotionOS || !settings.animationsEnabled;

  return useMemo(
    () => buildTheme(mode, settings.accentColor, { reduceMotion, compact: settings.compactMode }),
    [mode, settings.accentColor, reduceMotion, settings.compactMode]
  );
}
