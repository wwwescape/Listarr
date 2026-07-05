import { createTheme, type Theme } from "@mui/material/styles";
import { palettesForSeed, type ColorMode, type M3Scheme } from "./m3Colors";
import { m3ShapeScale } from "./m3Shape";
import { m3Typography } from "./m3Typography";

// M3 color roles MUI's own Palette/PaletteOptions interfaces don't have a
// home for (everything beyond primary/secondary/error/background/text/
// divider, which map onto MUI's standard fields below instead) — exposed as
// theme.palette.m3 for any component that wants a container/inverse/scrim
// token, or the tertiary role (mapped onto MUI's `warning` slot below too).
declare module "@mui/material/styles" {
  interface Palette {
    m3: M3Scheme;
  }
  interface PaletteOptions {
    m3?: M3Scheme;
  }
}

export interface BuildThemeOptions {
  reduceMotion?: boolean;
  compact?: boolean;
}

const reducedMotionCSS = `
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  }
`;
const forcedReducedMotionCSS = `
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
`;

export function buildTheme(
  mode: ColorMode,
  seedColor: string,
  { reduceMotion = false, compact = false }: BuildThemeOptions = {}
): Theme {
  const palettes = palettesForSeed(seedColor);
  const p = mode === "dark" ? palettes.dark : palettes.light;

  return createTheme({
    palette: {
      mode,
      primary: { main: p.primary, contrastText: p.onPrimary },
      secondary: { main: p.secondary, contrastText: p.onSecondary },
      error: { main: p.error, contrastText: p.onError },
      warning: { main: p.tertiary, contrastText: p.onTertiary },
      background: { default: p.background, paper: p.surface },
      text: { primary: p.onSurface, secondary: p.onSurfaceVariant },
      divider: p.outlineVariant,
      m3: p,
    },
    shape: { borderRadius: m3ShapeScale.medium },
    spacing: compact ? 6 : 8,
    typography: m3Typography,
    components: {
      // Respects the OS-level reduced-motion preference unconditionally,
      // plus an unconditional override when the user's Settings toggle
      // asks for it even though their OS doesn't.
      MuiCssBaseline: { styleOverrides: reduceMotion ? forcedReducedMotionCSS : reducedMotionCSS },
      // MUI's dark-mode Paper adds a lightening overlay gradient by default,
      // which fights the M3 surface tone we already computed — turn it off.
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: "none", borderRadius: m3ShapeScale.medium } },
      },
      MuiAppBar: { styleOverrides: { root: { borderRadius: m3ShapeScale.none } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: m3ShapeScale.extraLarge } } },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: m3ShapeScale.full, textTransform: "none", fontWeight: 600, paddingInline: 20 },
        },
      },
      MuiFab: { styleOverrides: { root: { boxShadow: "0 2px 6px rgba(0,0,0,0.25)" } } },
      MuiCard: { styleOverrides: { root: { borderRadius: m3ShapeScale.large } } },
      MuiListItem: {
        styleOverrides: {
          root: {
            borderRadius: m3ShapeScale.large,
            paddingTop: compact ? 0 : undefined,
            paddingBottom: compact ? 0 : undefined,
          },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: m3ShapeScale.small } } },
      MuiTextField: { defaultProps: { variant: "outlined" } },
    },
  });
}
