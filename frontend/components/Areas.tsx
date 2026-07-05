import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import List from "@mui/material/List";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import db, { type EntityId, type AreaRow } from "../db";
import * as sync from "../sync";
import { parseErrorDetail } from "../sync";
import SearchField, { STICKY_SEARCH_SX } from "./SearchField";
import EntityRow from "./EntityRow";

interface MenuState {
  anchorEl: HTMLElement;
  area: AreaRow;
}

// Tab content for managing the buying-area catalog, embedded in the Settings
// page — mirrors Categories.tsx exactly (same shape as Lists/Homes/Users:
// search, select-all bulk delete, a "…" menu per row), with no detail page:
// clicking a row opens the same Edit popup as the "…" menu, since there's
// nothing more to drill into.
const Areas = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formTarget, setFormTarget] = useState<AreaRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AreaRow | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<EntityId>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const allAreas = useLiveQuery(() => db.areas.toArray()) || [];
  const searchLower = searchQuery.trim().toLowerCase();
  const areas = allAreas.filter(
    (a) => !searchLower || a.area_name.toLowerCase().includes(searchLower)
  );

  useEffect(() => {
    sync.hydrateCatalog();
  }, []);

  const openMenu = (event: React.MouseEvent<HTMLElement>, area: AreaRow) =>
    setMenuState({ anchorEl: event.currentTarget, area });
  const closeMenu = () => setMenuState(null);

  const openAddForm = () => {
    setFormMode("add");
    setFormTarget(null);
    setFormName("");
    setFormError("");
    setFormOpen(true);
  };
  const openEditForm = (area: AreaRow) => {
    setFormMode("edit");
    setFormTarget(area);
    setFormName(area.area_name);
    setFormError("");
    setFormOpen(true);
  };
  const handleFormSave = async () => {
    if (!formName.trim()) return;
    setFormError("");
    if (formMode === "add") {
      await sync.createArea(formName.trim());
      setFormOpen(false);
      return;
    }
    if (!formTarget) return;
    const response = await sync.updateArea(formTarget.id, { area_name: formName.trim() });
    if (!response) return; // offline — sync.ts already surfaced a toast
    if (response.ok) {
      setFormOpen(false);
      return;
    }
    setFormError(await parseErrorDetail(response, "Failed to save area"));
  };

  const handleEditStart = () => {
    if (!menuState) return;
    openEditForm(menuState.area);
    closeMenu();
  };
  const handleDeleteStart = () => {
    if (!menuState) return;
    setDeleteTarget(menuState.area);
    setDeleteError("");
    closeMenu();
  };
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const response = await sync.deleteArea(deleteTarget.id);
    if (!response) return; // offline — sync.ts already surfaced a toast
    if (response.ok) {
      setDeleteTarget(null);
      return;
    }
    setDeleteError(await parseErrorDetail(response, "Failed to delete area"));
  };

  const toggleSelect = (id: EntityId) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());
  const handleBulkDeleteConfirm = async () => {
    const ids = [...selectedIds];
    setBulkDeleteConfirm(false);
    clearSelection();
    await Promise.all(ids.map((id) => sync.deleteArea(id)));
  };
  const toggleSelectAll = () => {
    if (areas.length > 0 && selectedIds.size === areas.length) clearSelection();
    else setSelectedIds(new Set(areas.map((a) => a.id)));
  };

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddForm}>
          Add Area
        </Button>
      </Box>

      {allAreas.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Typography variant="body1">No areas yet.</Typography>
          <Typography variant="body2">
            Tap &quot;Add Area&quot; to create your first one.
          </Typography>
        </Box>
      )}

      {areas.length > 0 && (
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1 }}>
          <Checkbox
            indeterminate={selectedIds.size > 0 && selectedIds.size < areas.length}
            checked={selectedIds.size === areas.length}
            onChange={toggleSelectAll}
            sx={{ ml: 0.5 }}
          />
          <Typography
            variant="body2"
            color={selectedIds.size > 0 ? "text.primary" : "text.secondary"}
          >
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {selectedIds.size > 0 && (
            <>
              <Button onClick={clearSelection}>Cancel</Button>
              <Button
                color="error"
                variant="contained"
                startIcon={<DeleteIcon />}
                onClick={() => setBulkDeleteConfirm(true)}
              >
                Delete
              </Button>
            </>
          )}
        </Stack>
      )}

      {allAreas.length > 0 && (
        <Box sx={{ ...STICKY_SEARCH_SX, mb: 1 }}>
          <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search areas…" />
        </Box>
      )}

      {allAreas.length > 0 && areas.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Typography variant="body1">No areas match your search.</Typography>
        </Box>
      )}

      <List sx={{ py: 0 }}>
        {areas.map((area) => (
          <EntityRow
            key={area.id}
            onClick={() => openEditForm(area)}
            primary={area.area_name}
            leading={
              <Checkbox
                checked={selectedIds.has(area.id)}
                onChange={() => toggleSelect(area.id)}
                onClick={(e) => e.stopPropagation()}
                sx={{ ml: 0.5 }}
              />
            }
            trailing={
              <IconButton
                edge="end"
                aria-label="area options"
                onClick={(e) => openMenu(e, area)}
                sx={{ mr: 1 }}
              >
                <MoreVertIcon />
              </IconButton>
            }
          />
        ))}
      </List>

      <Menu anchorEl={menuState?.anchorEl} open={!!menuState} onClose={closeMenu}>
        <MenuItem onClick={handleEditStart}>Edit</MenuItem>
        <MenuItem onClick={handleDeleteStart} sx={{ color: "error.main" }}>
          Delete
        </MenuItem>
      </Menu>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)}>
        <DialogTitle>{formMode === "add" ? "Add Area" : "Edit Area"}</DialogTitle>
        <DialogContent>
          {formError && (
            <DialogContentText color="error" sx={{ mb: 1 }}>
              {formError}
            </DialogContentText>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Area Name"
            fullWidth
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFormSave();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleFormSave} disabled={!formName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete area?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <DialogContentText color="error" sx={{ mb: 1 }}>
              {deleteError}
            </DialogContentText>
          )}
          <DialogContentText>
            {deleteTarget &&
              `"${deleteTarget.area_name}" will be permanently deleted. Items already tagged with it just lose that tag.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)}>
        <DialogTitle>
          Delete {selectedIds.size} area{selectedIds.size === 1 ? "" : "s"}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>The selected areas will be permanently deleted.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteConfirm(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleBulkDeleteConfirm}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Areas;
