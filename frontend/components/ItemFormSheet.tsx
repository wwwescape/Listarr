import React, { useEffect, useMemo, useRef, useState } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import Dialog from "@mui/material/Dialog";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import MenuItem from "@mui/material/MenuItem";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import TuneIcon from "@mui/icons-material/Tune";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import StarIcon from "@mui/icons-material/Star";
import HistoryIcon from "@mui/icons-material/History";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CreatableSelect from "react-select/creatable";
import type { ActionMeta } from "react-select";
import { parseQuickAdd } from "../utils/quickAdd";
import { reactSelectStyles } from "../theme/reactSelectStyles";
import { getSuggestions } from "../api/items";
import type { EntityId, ListItemRow } from "../db";
import type { SuggestionsOut } from "../api/types";

const PRIORITIES = ["low", "normal", "high"];

interface Option {
  value: EntityId;
  label: string;
  categoryId?: EntityId | null;
}

interface ItemDetails {
  quantity: number | string;
  unit: string;
  notes: string;
  priority: string;
  brand: string;
  favourite: boolean;
}

const emptyDetails: ItemDetails = {
  quantity: 1,
  unit: "",
  notes: "",
  priority: "normal",
  brand: "",
  favourite: false,
};

const emptySuggestions: SuggestionsOut = { favourites: [], recent: [], frequent: [] };

export interface SubmitPayload {
  item_id: EntityId | null;
  name: string;
  quantity: number;
  unit: string;
  notes: string;
  category_id: EntityId | null;
  area_id: EntityId | null;
  priority: string;
  brand: string;
  favourite: boolean;
  [key: string]: unknown;
}

interface ItemFormSheetProps {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  initialItem?: ListItemRow | null;
  itemOptions: Option[];
  categoryOptions: Option[];
  areaOptions: Option[];
  onCreateCategory: (name: string) => Promise<EntityId>;
  onCreateArea: (name: string) => Promise<EntityId>;
  onCreateCatalogItem: (name: string, categoryId: EntityId) => Promise<EntityId>;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  onDelete: () => void;
}

// Resolves a react-select value to a catalog id. New entries go through the
// sync engine (offline-capable, optimistic — returns a temp id immediately
// if offline); existing ones are just looked up in the already-loaded list.
const resolveId = async (
  label: string,
  isNew: boolean,
  options: Option[],
  onCreate: (label: string) => Promise<EntityId>
): Promise<EntityId | null> => {
  if (!label) return null;
  if (isNew) return onCreate(label);
  const existing = options.find((option) => option.label === label);
  return existing ? existing.value : null;
};

const ItemFormSheet = ({
  open,
  onClose,
  mode,
  initialItem,
  itemOptions,
  categoryOptions,
  areaOptions,
  onCreateCategory,
  onCreateArea,
  onCreateCatalogItem,
  onSubmit,
  onDelete,
}: ItemFormSheetProps) => {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("sm"));
  const selectStyles = useMemo(() => reactSelectStyles<Option, false>(theme), [theme]);

  const [itemName, setItemName] = useState("");
  const [selectedItem, setSelectedItem] = useState<Option | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Option | null>(null);
  const [newCategory, setNewCategory] = useState(false);

  const [areaName, setAreaName] = useState("");
  const [selectedArea, setSelectedArea] = useState<Option | null>(null);
  const [newArea, setNewArea] = useState(false);

  const [details, setDetails] = useState<ItemDetails>(emptyDetails);
  const [showMore, setShowMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionsOut>(emptySuggestions);
  const nameInputRef = useRef<React.ElementRef<typeof CreatableSelect<Option, false>> | null>(null);

  // A dropdown pick (selectedItem) always wins over whatever's left in the
  // search text — the two are kept mutually exclusive (see handleItemChange).
  const currentName = (selectedItem?.label ?? itemName).trim();

  useEffect(() => {
    if (!open || mode !== "add") return;
    getSuggestions()
      .then(setSuggestions)
      .catch((error) => console.error("Error fetching suggestions:", error));
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialItem) {
      setItemName("");
      setSelectedItem(initialItem.name ? { value: initialItem.item_id ?? "", label: initialItem.name } : null);
      setCategoryName(initialItem.category?.category_name || "");
      setSelectedCategory(
        initialItem.category ? { value: initialItem.category.id, label: initialItem.category.category_name } : null
      );
      setNewCategory(false);
      setAreaName(initialItem.area?.area_name || "");
      setSelectedArea(initialItem.area ? { value: initialItem.area.id, label: initialItem.area.area_name } : null);
      setNewArea(false);
      setDetails({
        quantity: initialItem.quantity ?? 1,
        unit: initialItem.unit || "",
        notes: initialItem.notes || "",
        priority: initialItem.priority || "normal",
        brand: initialItem.brand || "",
        favourite: !!initialItem.favourite,
      });
      setShowMore(true);
    } else {
      setItemName("");
      setSelectedItem(null);
      setCategoryName("");
      setSelectedCategory(null);
      setNewCategory(false);
      setAreaName("");
      setSelectedArea(null);
      setNewArea(false);
      setDetails(emptyDetails);
      setShowMore(false);
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [open, mode, initialItem]);

  const handleItemChange = (newValue: Option | null, actionMeta: ActionMeta<Option>) => {
    if (actionMeta.action === "select-option" && newValue) {
      // Picking an existing catalog entry just fills the field — it never
      // submits on its own, so the user can still fill in quantity/notes/
      // category/etc. before explicitly clicking "Add item". Clear the
      // search text rather than mirroring the label into it: react-select
      // renders its own value display from `value`, and leaving a non-empty
      // controlled inputValue alongside it is what made the label vanish
      // until the menu was reopened.
      setItemName("");
      setSelectedItem(newValue);
    } else if (actionMeta.action === "clear") {
      setItemName("");
      setSelectedItem(null);
    }
  };

  const handleCategoryChange = (newValue: Option | null, actionMeta: ActionMeta<Option>) => {
    if (actionMeta.action === "create-option" && newValue) {
      setNewCategory(true);
      setCategoryName(newValue.label);
      setSelectedCategory(newValue);
    } else if (actionMeta.action === "select-option" && newValue) {
      setNewCategory(false);
      setCategoryName(newValue.label);
      setSelectedCategory(newValue);
    } else if (actionMeta.action === "clear") {
      setNewCategory(false);
      setCategoryName("");
      setSelectedCategory(null);
    }
  };

  const handleAreaChange = (newValue: Option | null, actionMeta: ActionMeta<Option>) => {
    if (actionMeta.action === "create-option" && newValue) {
      setNewArea(true);
      setAreaName(newValue.label);
      setSelectedArea(newValue);
    } else if (actionMeta.action === "select-option" && newValue) {
      setNewArea(false);
      setAreaName(newValue.label);
      setSelectedArea(newValue);
    } else if (actionMeta.action === "clear") {
      setNewArea(false);
      setAreaName("");
      setSelectedArea(null);
    }
  };

  const handleSubmit = async () => {
    if (!currentName || submitting) return;

    // A dropdown pick (selectedItem set) is already a clean, resolved name —
    // only free-typed text needs quick-add parsing, since react-select only
    // fires onChange when an option is actually committed, so typing
    // "2kg potatoes" and clicking Add directly (without picking the
    // highlighted option first) leaves the raw, unparsed text in itemName.
    let finalName = currentName;
    let finalIsNewItem = !selectedItem;
    let finalQuantity = Number(details.quantity) || 1;
    let finalUnit = details.unit;
    if (mode === "add" && !selectedItem) {
      const parsed = parseQuickAdd(itemName);
      const existingMatch = itemOptions.find(
        (option) => option.label.toLowerCase() === parsed.name.toLowerCase()
      );
      finalName = existingMatch ? existingMatch.label : parsed.name;
      finalIsNewItem = !existingMatch;
      // Only let the parse win when it actually found something — a
      // manually-expanded quantity/unit field the user already edited by
      // hand shouldn't be clobbered back to the name text's defaults.
      finalQuantity = parsed.quantity !== 1 ? parsed.quantity : finalQuantity;
      finalUnit = parsed.unit || finalUnit;
    }

    setSubmitting(true);
    try {
      let categoryId = await resolveId(categoryName, newCategory, categoryOptions, onCreateCategory);
      // Best-guess category: only when the user hasn't picked one themselves
      // and the name resolved to an existing catalog entry that already
      // carries a category — a real historical association, not a fuzzy
      // keyword guess, so it's safe to apply automatically.
      if (!categoryId && !finalIsNewItem) {
        const matchedItem = itemOptions.find(
          (option) => option.label.toLowerCase() === finalName.toLowerCase()
        );
        if (matchedItem?.categoryId) categoryId = matchedItem.categoryId;
      }
      const areaId = await resolveId(areaName, newArea, areaOptions, onCreateArea);
      // Catalog items require a category. Quick-add intentionally skips
      // category selection for speed, so a brand-new name with no category
      // just isn't linked to the catalog yet — the list item itself still
      // gets created with its free-text name either way.
      const itemId = await resolveId(
        finalName,
        finalIsNewItem && !!categoryId,
        itemOptions,
        (name) => onCreateCatalogItem(name, categoryId!)
      );

      await onSubmit({
        item_id: itemId,
        name: finalName.trim(),
        quantity: Number(finalQuantity) || 1,
        unit: finalUnit,
        notes: details.notes,
        category_id: categoryId,
        area_id: areaId,
        priority: details.priority,
        brand: details.brand,
        favourite: details.favourite,
      });

      if (mode === "edit") {
        onClose();
      } else {
        // Quick-add: clear the name and keep the sheet open for the next item.
        setItemName("");
        setSelectedItem(null);
        nameInputRef.current?.focus();
      }
    } catch (error) {
      console.error("Error saving item:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // One-tap add from a favourites/recent/frequent suggestion — everything
  // (catalog id, category, area) is already resolved from the historical
  // row, so this skips resolveOptionId entirely and submits directly.
  const handleSuggestionTap = async (suggestion: ListItemRow) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        item_id: suggestion.item_id ?? null,
        name: suggestion.name,
        quantity: 1,
        unit: suggestion.unit || "",
        notes: "",
        category_id: suggestion.category_id ?? null,
        area_id: suggestion.area_id ?? null,
        priority: "normal",
        brand: suggestion.brand || "",
        favourite: !!suggestion.favourite,
      });
    } catch (error) {
      console.error("Error adding suggested item:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const parsedPreview = useMemo(() => parseQuickAdd(itemName), [itemName]);
  const showParsePreview =
    mode === "add" && itemName.trim() && (parsedPreview.quantity !== 1 || parsedPreview.unit) &&
    parsedPreview.name.toLowerCase() !== itemName.trim().toLowerCase();

  const hasSuggestions =
    suggestions.favourites.length > 0 || suggestions.recent.length > 0 || suggestions.frequent.length > 0;

  const renderSuggestionRow = (label: string, icon: React.ReactNode, items: ListItemRow[]) =>
    items.length > 0 && (
      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
          {icon}
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 0.5 }}>
          {items.map((item) => (
            <Chip
              key={item.id}
              label={item.name}
              onClick={() => handleSuggestionTap(item)}
              disabled={submitting}
              sx={{ flexShrink: 0 }}
            />
          ))}
        </Box>
      </Box>
    );

  const content = (
    <Box sx={{ p: 3, pb: 4 }}>
      {isCompact && <Box sx={{ width: 40, height: 4, bgcolor: "divider", borderRadius: 2, mx: "auto", mb: 2 }} />}

        {mode === "add" && !currentName && hasSuggestions && (
          <Box sx={{ mb: 2 }}>
            {renderSuggestionRow("Favourites", <StarIcon fontSize="small" color="warning" />, suggestions.favourites)}
            {renderSuggestionRow("Recent", <HistoryIcon fontSize="small" color="action" />, suggestions.recent)}
            {renderSuggestionRow("Frequent", <TrendingUpIcon fontSize="small" color="action" />, suggestions.frequent)}
          </Box>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: showParsePreview ? 0.5 : 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <CreatableSelect<Option, false>
              autoFocus
              isClearable
              isValidNewOption={() => false}
              // Default filtering matches the raw typed text against each
              // label, so quick-add shorthand ("2 milk") never substring-
              // matches "Milk" — strip the quantity/unit prefix the same way
              // handleSubmit's fallback does, so the option still surfaces.
              filterOption={(option, rawInput) => {
                const needle = (parseQuickAdd(rawInput).name || rawInput).trim().toLowerCase();
                return !needle || option.label.toLowerCase().includes(needle);
              }}
              placeholder="Item name — try '2kg potatoes' or '3x eggs'"
              onChange={handleItemChange}
              options={itemOptions}
              value={selectedItem}
              inputValue={itemName}
              onInputChange={(value, meta) => {
                // Typing invalidates any previously selected option — the
                // two are mutually exclusive (see handleItemChange).
                if (meta.action === "input-change") {
                  setItemName(value);
                  setSelectedItem(null);
                }
              }}
              ref={nameInputRef}
              menuPlacement={isCompact ? "top" : "auto"}
              menuPortalTarget={document.body}
              styles={selectStyles}
            />
          </Box>
          <IconButton onClick={() => setShowMore((v) => !v)} aria-label="more options" color={showMore ? "primary" : "default"}>
            <TuneIcon />
          </IconButton>
        </Box>

        {showParsePreview && (
          <Typography variant="caption" color="primary" sx={{ display: "block", mb: 2, ml: 1 }}>
            {parsedPreview.quantity} {parsedPreview.unit} {parsedPreview.name}
          </Typography>
        )}

        <Collapse in={showMore}>
          <Grid container spacing={2} sx={{ mb: 1 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Quantity"
                type="number"
                value={details.quantity}
                onChange={(e) => setDetails({ ...details, quantity: e.target.value })}
                fullWidth
                margin="dense"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Unit"
                placeholder="kg, L, pcs..."
                value={details.unit}
                onChange={(e) => setDetails({ ...details, unit: e.target.value })}
                fullWidth
                margin="dense"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Priority"
                value={details.priority}
                onChange={(e) => setDetails({ ...details, priority: e.target.value })}
                fullWidth
                margin="dense"
              >
                {PRIORITIES.map((priority) => (
                  <MenuItem key={priority} value={priority}>
                    {priority}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Category
              </Typography>
              <CreatableSelect
                isClearable
                placeholder="Category"
                onChange={handleCategoryChange}
                options={categoryOptions}
                value={selectedCategory}
                menuPortalTarget={document.body}
                styles={selectStyles}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Area
              </Typography>
              <CreatableSelect
                isClearable
                placeholder="Area"
                onChange={handleAreaChange}
                options={areaOptions}
                value={selectedArea}
                menuPortalTarget={document.body}
                styles={selectStyles}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Brand"
                value={details.brand}
                onChange={(e) => setDetails({ ...details, brand: e.target.value })}
                fullWidth
                margin="dense"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Notes"
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                fullWidth
                margin="dense"
              />
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={details.favourite}
                    onChange={(e) => setDetails({ ...details, favourite: e.target.checked })}
                  />
                }
                label="Favourite"
              />
            </Grid>
          </Grid>
        </Collapse>

        <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
          {mode === "edit" && (
            <Button color="error" startIcon={<DeleteIcon />} onClick={onDelete}>
              Delete
            </Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="contained"
            startIcon={mode === "add" ? <AddIcon /> : undefined}
            onClick={() => handleSubmit()}
            disabled={!currentName || submitting}
          >
            {mode === "edit" ? "Save" : "Add item"}
          </Button>
        </Box>
    </Box>
  );

  return isCompact ? (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      slotProps={{ paper: { sx: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85vh" } } }}
    >
      {content}
    </SwipeableDrawer>
  ) : (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {content}
    </Dialog>
  );
};

export default ItemFormSheet;
