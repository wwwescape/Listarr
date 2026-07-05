// M3 type-scale mapped onto MUI's variant names, Roboto throughout (loaded
// via @fontsource/roboto in index.jsx).
const fontFamily = '"Roboto", "Helvetica", "Arial", sans-serif';

export const m3Typography = {
  fontFamily,
  h1: { fontFamily, fontSize: "3.5rem", lineHeight: 1.12, fontWeight: 400 },
  h2: { fontFamily, fontSize: "2.8125rem", lineHeight: 1.15, fontWeight: 400 },
  h3: { fontFamily, fontSize: "2.25rem", lineHeight: 1.22, fontWeight: 400 },
  h4: { fontFamily, fontSize: "2rem", lineHeight: 1.25, fontWeight: 400 },
  h5: { fontFamily, fontSize: "1.75rem", lineHeight: 1.28, fontWeight: 400 },
  h6: { fontFamily, fontSize: "1.5rem", lineHeight: 1.33, fontWeight: 500 },
  subtitle1: { fontFamily, fontSize: "1.375rem", lineHeight: 1.27, fontWeight: 400 },
  subtitle2: { fontFamily, fontSize: "1rem", lineHeight: 1.5, fontWeight: 500 },
  body1: { fontFamily, fontSize: "1rem", lineHeight: 1.5, fontWeight: 400 },
  body2: { fontFamily, fontSize: "0.875rem", lineHeight: 1.43, fontWeight: 400 },
  caption: { fontFamily, fontSize: "0.75rem", lineHeight: 1.33, fontWeight: 400 },
  button: { fontFamily, fontSize: "0.875rem", lineHeight: 1.43, fontWeight: 500, textTransform: "none" as const },
  overline: {
    fontFamily,
    fontSize: "0.6875rem",
    lineHeight: 1.45,
    fontWeight: 500,
    textTransform: "uppercase" as const,
  },
};
