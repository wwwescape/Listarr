import React from "react";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import type { SxProps, Theme } from "@mui/material/styles";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  sx?: SxProps<Theme>;
}

// Shared across the Lists/Homes/Users/List-detail search bars so the clear
// (x) affordance and sticky-on-scroll behavior stay consistent everywhere
// rather than being reimplemented per page.
const SearchField = ({ value, onChange, placeholder, sx }: SearchFieldProps) => (
  <TextField
    fullWidth
    size="small"
    placeholder={placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    slotProps={{
      input: {
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton size="small" aria-label="clear search" edge="end" onClick={() => onChange("")}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : undefined,
      },
    }}
    sx={sx}
  />
);

export default SearchField;

// Offsets sticky search bars below the fixed AppBar (56px on xs, 64px on
// sm+ — MUI's default Toolbar heights, unmodified by this app's theme) so
// they dock under it instead of being hidden behind its higher z-index.
export const STICKY_SEARCH_SX: SxProps<Theme> = {
  position: "sticky",
  top: { xs: 56, sm: 64 },
  zIndex: 1,
  bgcolor: "background.default",
  pt: 1,
  pb: 1,
};
