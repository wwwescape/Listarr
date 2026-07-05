import type { Theme } from "@mui/material/styles";
import type { StylesConfig } from "react-select";

// react-select ships its own inline styles (white control/menu, dark text)
// that don't react to MUI's theme at all — left alone it looks "broken" in
// dark mode. This maps its style slots onto the current theme's palette so
// it reads as part of the same design system as the surrounding MUI fields.
export function reactSelectStyles<Option, IsMulti extends boolean = false>(
  theme: Theme
): StylesConfig<Option, IsMulti> {
  return {
    control: (base, state) => ({
      ...base,
      backgroundColor: theme.palette.background.paper,
      borderColor: state.isFocused ? theme.palette.primary.main : theme.palette.divider,
      boxShadow: state.isFocused ? `0 0 0 1px ${theme.palette.primary.main}` : "none",
      minHeight: 40,
      "&:hover": { borderColor: theme.palette.primary.main },
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: theme.palette.background.paper,
      zIndex: theme.zIndex.modal,
    }),
    menuPortal: (base) => ({ ...base, zIndex: theme.zIndex.modal }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? theme.palette.primary.main
        : state.isFocused
          ? theme.palette.action.hover
          : "transparent",
      color: state.isSelected ? theme.palette.primary.contrastText : theme.palette.text.primary,
      cursor: "pointer",
    }),
    singleValue: (base) => ({ ...base, color: theme.palette.text.primary }),
    input: (base) => ({ ...base, color: theme.palette.text.primary }),
    placeholder: (base) => ({ ...base, color: theme.palette.text.secondary }),
    indicatorSeparator: (base) => ({ ...base, backgroundColor: theme.palette.divider }),
    dropdownIndicator: (base) => ({ ...base, color: theme.palette.text.secondary }),
    clearIndicator: (base) => ({ ...base, color: theme.palette.text.secondary }),
    multiValue: (base) => ({ ...base, backgroundColor: theme.palette.action.selected }),
    multiValueLabel: (base) => ({ ...base, color: theme.palette.text.primary }),
    noOptionsMessage: (base) => ({ ...base, color: theme.palette.text.secondary }),
  };
}
