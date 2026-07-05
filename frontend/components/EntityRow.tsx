import React, { type ReactNode } from "react";
import Paper from "@mui/material/Paper";
import ButtonBase from "@mui/material/ButtonBase";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface EntityRowProps {
  primary: ReactNode;
  secondary?: ReactNode;
  /** Rendered as a row below primary/secondary — e.g. role/admin/home chips. */
  chips?: ReactNode;
  onClick: () => void;
  /** Checkbox (bulk-select) or a same-width spacer Box, if the page has one. */
  leading?: ReactNode;
  /** The "⋮" options IconButton, if this row has one. */
  trailing?: ReactNode;
}

// Shared row shape for every "list of X" screen (Lists, Homes, Users, and
// the Homes/Lists/Users tabs on the Home/List/User detail pages) — kept as
// one component specifically so they can't drift apart visually. Primary
// text on its own line, an optional secondary/subtitle line below it, then
// chips on a third line below that (never inline next to the text) — the
// one deliberate exception is the shopping-list Items tab inside List.tsx,
// which has its own quantity-prefixed inline layout and doesn't use this.
const EntityRow = ({ primary, secondary, chips, onClick, leading, trailing }: EntityRowProps) => (
  <Paper
    component="li"
    variant="outlined"
    sx={{
      display: "flex",
      alignItems: "center",
      mb: 1,
      borderRadius: 2,
      listStyle: "none",
      transition: "box-shadow 150ms ease, transform 150ms ease",
      "&:hover": { boxShadow: 3, transform: "translateY(-1px)" },
    }}
  >
    {leading}
    <ButtonBase onClick={onClick} sx={{ flexGrow: 1, justifyContent: "flex-start", borderRadius: 2, py: 1.25, px: 2 }}>
      <Box sx={{ width: "100%", textAlign: "left" }}>
        <Typography sx={{ fontWeight: 500 }}>{primary}</Typography>
        {secondary && (
          <Typography variant="body2" color="text.secondary">
            {secondary}
          </Typography>
        )}
        {chips && <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>{chips}</Box>}
      </Box>
    </ButtonBase>
    {trailing}
  </Paper>
);

export default EntityRow;
