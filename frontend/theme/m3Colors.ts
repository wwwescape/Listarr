import { Hct, SchemeVibrant, argbFromHex, hexFromArgb } from "@material/material-color-utilities";

// A fresh green seed reads as "grocery/shopping" and generates a full M3
// tonal palette (primary/secondary/tertiary/surface/etc.) via Google's own
// HCT color algorithm — real dynamic color, not a hand-picked palette.
// Overridable from Settings; this is just the shipped default.
export const DEFAULT_SEED_COLOR = "#2E7D5A";

export type ColorMode = "light" | "dark";

export interface M3Scheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  // Extra roles beyond what MUI's palette slots map onto directly — stashed
  // in theme.m3 for any future use of container/inverse/scrim tokens.
  shadow: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
}

const ROLE_KEYS: (keyof M3Scheme)[] = [
  "primary", "onPrimary", "primaryContainer", "onPrimaryContainer",
  "secondary", "onSecondary", "secondaryContainer", "onSecondaryContainer",
  "tertiary", "onTertiary", "tertiaryContainer", "onTertiaryContainer",
  "error", "onError", "errorContainer", "onErrorContainer",
  "background", "onBackground", "surface", "onSurface",
  "surfaceVariant", "onSurfaceVariant", "outline", "outlineVariant",
  "shadow", "scrim", "inverseSurface", "inverseOnSurface", "inversePrimary",
];

function toScheme(dynamicScheme: unknown): M3Scheme {
  const scheme = {} as M3Scheme;
  for (const role of ROLE_KEYS) {
    // DynamicScheme exposes each role as a getter returning an ARGB int.
    scheme[role] = hexFromArgb((dynamicScheme as Record<string, number>)[role]);
  }
  return scheme;
}

// HCT + dynamic-scheme conversion isn't free — cache per seed+mode rather
// than recomputing on every render (there's only ever a handful of colors a
// user picks). Contrast is fixed at "normal" (0) — no high-contrast toggle
// exists in Settings today.
const paletteCache = new Map<string, { light: M3Scheme; dark: M3Scheme }>();

export function palettesForSeed(seedColor: string): { light: M3Scheme; dark: M3Scheme } {
  if (!paletteCache.has(seedColor)) {
    const sourceHct = Hct.fromInt(argbFromHex(seedColor));
    const light = new SchemeVibrant(sourceHct, false, 0);
    const dark = new SchemeVibrant(sourceHct, true, 0);
    paletteCache.set(seedColor, { light: toScheme(light), dark: toScheme(dark) });
  }
  return paletteCache.get(seedColor)!;
}
