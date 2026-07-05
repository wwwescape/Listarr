import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Fab,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  Typography,
  Stack,
  List as MuiList,
  ListSubheader,
  MenuItem,
  Menu,
  Select,
  FormControl,
  InputLabel,
  Box,
  Chip,
  IconButton,
  ButtonBase,
  Collapse,
  Checkbox,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import db, { type EntityId, type ListRow } from "../db";
import * as sync from "../sync";
import { getCachedCurrentUser } from "../sync";
import { getCollaborators } from "../api/lists";
import SearchField, { STICKY_SEARCH_SX } from "./SearchField";
import EntityRow from "./EntityRow";
import ListFormDialog, { type ListFormValues } from "./ListFormDialog";
import type { UserOut } from "../api/types";

interface MenuState {
  anchorEl: HTMLElement;
  list: ListRow;
}

const Lists = () => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allCollaborators, setAllCollaborators] = useState<UserOut[]>([]);
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ListRow | null>(null);
  const [homeTarget, setHomeTarget] = useState<ListRow | null>(null);
  const [homeSelectValue, setHomeSelectValue] = useState<EntityId | "">("");
  const [selectedIds, setSelectedIds] = useState<Set<EntityId>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("sm"));

  const lists = useLiveQuery(() => db.lists.toArray()) || [];
  const recents = useLiveQuery(() => db.recents.orderBy("lastOpenedAt").reverse().toArray()) || [];
  const homes = useLiveQuery(() => db.homes.toArray()) || [];
  const currentUser = getCachedCurrentUser();
  // Placing a list into a household requires being that household's owner
  // or co-owner (or an Admin) — a plain member can't assign lists to a
  // household they only belong to.
  const assignableHomes = homes.filter(
    (h) => currentUser?.admin || h.my_role === "owner" || h.my_role === "co_owner"
  );

  // Deleting is narrower than viewing/editing: admin, the list's own
  // creator, or the owner of the home it's assigned to (matches the
  // backend's can_delete_list — a collaborator or non-owner home member can
  // still open/edit the list but won't get a checkbox here).
  const canDeleteList = (list: ListRow) => {
    if (currentUser?.admin) return true;
    if (currentUser && String(list.createdBy) === String(currentUser.id)) return true;
    if (list.home_id) {
      const home = homes.find((h) => h.id === list.home_id);
      if (home?.my_role === "owner") return true;
    }
    return false;
  };

  useEffect(() => {
    sync.hydrateLists();
    sync.fetchHomes();

    const fetchAllCollaborators = async () => {
      try {
        setAllCollaborators(await getCollaborators());
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchAllCollaborators();

    const goOnline = () => {
      sync.hydrateLists();
      sync.fetchHomes();
    };
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("online", goOnline);
    };
  }, [navigate]);

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleSave = async (values: ListFormValues) => {
    await sync.createList(values);
    setOpen(false);
  };

  const handleListClick = (listId: EntityId) => navigate(`/list/${listId}`);

  const openMenu = (event: React.MouseEvent<HTMLElement>, list: ListRow) =>
    setMenuState({ anchorEl: event.currentTarget, list });
  const closeMenu = () => setMenuState(null);

  const handleToggleFavourite = (list: ListRow) => sync.updateList(list.id, { favourite: !list.favourite });

  const handleDuplicate = async () => {
    if (!menuState) return;
    const list = menuState.list;
    closeMenu();
    await sync.duplicateList(list.id);
  };

  const handleToggleArchive = async () => {
    if (!menuState) return;
    const list = menuState.list;
    closeMenu();
    await sync.updateList(list.id, { status: list.status === "archived" ? "active" : "archived" });
  };

  const handleDeleteStart = () => {
    if (!menuState) return;
    setDeleteTarget(menuState.list);
    closeMenu();
  };
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await sync.deleteList(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleMoveToHomeStart = () => {
    if (!menuState) return;
    setHomeTarget(menuState.list);
    setHomeSelectValue(menuState.list.home_id || "");
    closeMenu();
  };
  const handleMoveToHomeConfirm = async () => {
    if (!homeTarget) return;
    await sync.updateList(homeTarget.id, { home_id: homeSelectValue || null });
    setHomeTarget(null);
  };
  const handleRemoveFromHome = async () => {
    if (!menuState) return;
    const list = menuState.list;
    closeMenu();
    await sync.updateList(list.id, { home_id: null });
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
    await Promise.all(ids.map((id) => sync.deleteList(id)));
  };

  const searchLower = searchQuery.trim().toLowerCase();
  const matchesSearch = (list: ListRow) => !searchLower || list.name.toLowerCase().includes(searchLower);
  const searchedLists = lists.filter(matchesSearch);
  const activeLists = searchedLists.filter((l) => l.status !== "archived");
  const archivedLists = searchedLists.filter((l) => l.status === "archived");
  const favouriteLists = activeLists.filter((l) => l.favourite);
  const recentIds = recents
    .map((r) => r.listId)
    .filter((id) => activeLists.some((l) => l.id === id && !l.favourite))
    .slice(0, 5);
  const recentLists = recentIds
    .map((id) => activeLists.find((l) => l.id === id))
    .filter((l): l is ListRow => Boolean(l));
  const shownIds = new Set([...favouriteLists.map((l) => l.id), ...recentLists.map((l) => l.id)]);
  const otherLists = activeLists.filter((l) => !shownIds.has(l.id));

  // "Select all" only ever selects what's actually on screen right now —
  // archived lists are excluded unless that section is expanded, matching
  // what the checkboxes the user can already see cover.
  const selectableLists = [...activeLists, ...(archivedExpanded ? archivedLists : [])].filter(canDeleteList);
  const toggleSelectAll = () => {
    if (selectableLists.length > 0 && selectedIds.size === selectableLists.length) clearSelection();
    else setSelectedIds(new Set(selectableLists.map((l) => l.id)));
  };

  const renderListRow = (list: ListRow) => (
    <EntityRow
      key={list.id}
      onClick={() => handleListClick(list.id)}
      primary={list.name}
      chips={list.home && <Chip size="small" label={list.home.name} />}
      leading={
        canDeleteList(list) ? (
          <Checkbox
            checked={selectedIds.has(list.id)}
            onChange={() => toggleSelect(list.id)}
            onClick={(e) => e.stopPropagation()}
            sx={{ ml: 0.5 }}
          />
        ) : (
          <Box sx={{ width: 42, flexShrink: 0 }} />
        )
      }
      trailing={
        <>
          <IconButton edge="end" aria-label="favourite list" onClick={() => handleToggleFavourite(list)} sx={{ mr: 0.5 }}>
            {list.favourite ? <StarIcon color="warning" /> : <StarBorderIcon />}
          </IconButton>
          <IconButton edge="end" aria-label="list options" onClick={(e) => openMenu(e, list)} sx={{ mr: 1 }}>
            <MoreVertIcon />
          </IconButton>
        </>
      }
    />
  );

  const renderSection = (title: string, items: ListRow[]) =>
    items.length > 0 && (
      <MuiList
        subheader={
          <ListSubheader disableSticky sx={{ bgcolor: "transparent", fontWeight: 600, lineHeight: 2.5, px: 0 }}>
            {title}
          </ListSubheader>
        }
        sx={{ py: 0 }}
      >
        {items.map(renderListRow)}
      </MuiList>
    );

  return (
    <Box component="main">
      <Stack direction="row" sx={{ gap: 1, mb: 2, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <Typography component="h1" variant="h4">
          Lists
        </Typography>
        {isCompact ? (
          <Fab color="primary" aria-label="add" onClick={handleClickOpen} size="medium">
            <AddIcon />
          </Fab>
        ) : (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleClickOpen}>
            Add List
          </Button>
        )}
      </Stack>

      {lists.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Typography variant="body1">No lists yet.</Typography>
          <Typography variant="body2">Tap &quot;Add List&quot; to create your first list.</Typography>
        </Box>
      )}

      {selectableLists.length > 0 && (
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1 }}>
          <Checkbox
            indeterminate={selectedIds.size > 0 && selectedIds.size < selectableLists.length}
            checked={selectedIds.size === selectableLists.length}
            onChange={toggleSelectAll}
            sx={{ ml: 0.5 }}
          />
          <Typography variant="body2" color={selectedIds.size > 0 ? "text.primary" : "text.secondary"}>
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

      {lists.length > 0 && (
        <Box sx={{ ...STICKY_SEARCH_SX, mb: 1 }}>
          <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search lists…" />
        </Box>
      )}

      {lists.length > 0 && searchedLists.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Typography variant="body1">No lists match your search.</Typography>
        </Box>
      )}

      {renderSection("Favourites", favouriteLists)}
      {renderSection("Recent", recentLists)}
      {renderSection(favouriteLists.length || recentLists.length ? "All Lists" : "", otherLists)}

      {archivedLists.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <ButtonBase
            onClick={() => setArchivedExpanded((v) => !v)}
            sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.5, borderRadius: 1 }}
          >
            <ExpandMoreIcon
              fontSize="small"
              sx={{ transform: archivedExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
            />
            <Typography variant="subtitle2" color="text.secondary">
              Archived ({archivedLists.length})
            </Typography>
          </ButtonBase>
          <Collapse in={archivedExpanded}>
            <MuiList>{archivedLists.map(renderListRow)}</MuiList>
          </Collapse>
        </Box>
      )}

      <Menu anchorEl={menuState?.anchorEl} open={!!menuState} onClose={closeMenu}>
        <MenuItem onClick={handleDuplicate}>Duplicate</MenuItem>
        <MenuItem onClick={handleToggleArchive}>
          {menuState?.list.status === "archived" ? "Unarchive" : "Archive"}
        </MenuItem>
        {assignableHomes.length > 0 && <MenuItem onClick={handleMoveToHomeStart}>Move to home…</MenuItem>}
        {menuState?.list.home_id && <MenuItem onClick={handleRemoveFromHome}>Remove from home</MenuItem>}
        <MenuItem onClick={handleDeleteStart} sx={{ color: "error.main" }}>
          Delete
        </MenuItem>
      </Menu>

      <ListFormDialog
        open={open}
        mode="add"
        initialValues={{ name: "", collaborators: [], home_id: null }}
        allCollaborators={allCollaborators}
        assignableHomes={assignableHomes}
        onClose={handleClose}
        onSubmit={handleSave}
      />

      <Dialog open={!!homeTarget} onClose={() => setHomeTarget(null)}>
        <DialogTitle>Move to home</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense">
            <InputLabel>Home</InputLabel>
            <Select value={homeSelectValue} label="Home" onChange={(e) => setHomeSelectValue(e.target.value)}>
              <MenuItem value="">None</MenuItem>
              {assignableHomes.map((home) => (
                <MenuItem key={home.id} value={home.id}>
                  {home.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHomeTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleMoveToHomeConfirm}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete list?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget && `"${deleteTarget.name}" and all its items will be permanently deleted.`}
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
          Delete {selectedIds.size} list{selectedIds.size === 1 ? "" : "s"}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            The selected lists and all their items will be permanently deleted.
          </DialogContentText>
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

export default Lists;
