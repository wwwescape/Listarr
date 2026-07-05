import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Fab from "@mui/material/Fab";
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
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Button from "@mui/material/Button";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import db, { type EntityId, type HomeRow } from "../db";
import * as sync from "../sync";
import { getCachedCurrentUser } from "../sync";
import { listUsers } from "../api/users";
import SearchField, { STICKY_SEARCH_SX } from "./SearchField";
import EntityRow from "./EntityRow";
import type { UserOut } from "../api/types";

interface MenuState {
  anchorEl: HTMLElement;
  home: HomeRow;
}

const Homes = () => {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const currentUser = getCachedCurrentUser();
  const isAdmin = !!currentUser?.admin;

  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createOwnerId, setCreateOwnerId] = useState<EntityId | "">("");
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HomeRow | null>(null);
  const [allUsers, setAllUsers] = useState<UserOut[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<EntityId>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const allHomes = useLiveQuery(() => db.homes.toArray()) || [];
  const searchLower = searchQuery.trim().toLowerCase();
  const homes = allHomes.filter((h) => !searchLower || h.name.toLowerCase().includes(searchLower));

  useEffect(() => {
    sync.fetchHomes();
    listUsers()
      .then(setAllUsers)
      .catch(() => {});
  }, []);

  const canDeleteHome = (home: HomeRow) => isAdmin || home.my_role === "owner";

  const openMenu = (event: React.MouseEvent<HTMLElement>, home: HomeRow) =>
    setMenuState({ anchorEl: event.currentTarget, home });
  const closeMenu = () => setMenuState(null);

  const handleCreate = async () => {
    if (!createName.trim() || !createOwnerId) return;
    await sync.createHome(createName.trim(), createOwnerId);
    setCreateOpen(false);
    setCreateName("");
    setCreateOwnerId("");
  };

  const handleDeleteStart = () => {
    if (!menuState) return;
    setDeleteTarget(menuState.home);
    closeMenu();
  };
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await sync.deleteHome(deleteTarget.id);
    setDeleteTarget(null);
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
    await Promise.all(ids.map((id) => sync.deleteHome(id)));
  };

  const selectableHomes = homes.filter(canDeleteHome);
  const toggleSelectAll = () => {
    if (selectableHomes.length > 0 && selectedIds.size === selectableHomes.length) clearSelection();
    else setSelectedIds(new Set(selectableHomes.map((h) => h.id)));
  };

  return (
    <Box component="main">
      <Stack direction="row" sx={{ gap: 1, mb: 2, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <Typography component="h1" variant="h4">
          Homes
        </Typography>
        {isAdmin &&
          (isCompact ? (
            <Fab color="primary" aria-label="add home" onClick={() => setCreateOpen(true)} size="medium">
              <AddIcon />
            </Fab>
          ) : (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Add Home
            </Button>
          ))}
      </Stack>

      {allHomes.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Typography variant="body1">No homes yet.</Typography>
          <Typography variant="body2">
            {isAdmin ? "Create one to share lists with a household." : "Ask an admin to create one for your household."}
          </Typography>
        </Box>
      )}

      {selectableHomes.length > 0 && (
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1 }}>
          <Checkbox
            indeterminate={selectedIds.size > 0 && selectedIds.size < selectableHomes.length}
            checked={selectedIds.size === selectableHomes.length}
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

      {allHomes.length > 0 && (
        <Box sx={{ ...STICKY_SEARCH_SX, mb: 1 }}>
          <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search homes…" />
        </Box>
      )}

      {allHomes.length > 0 && homes.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Typography variant="body1">No homes match your search.</Typography>
        </Box>
      )}

      <List sx={{ py: 0 }}>
        {homes.map((home) => (
          <EntityRow
            key={home.id}
            onClick={() => navigate(`/home/${home.id}`)}
            primary={home.name}
            leading={
              canDeleteHome(home) ? (
                <Checkbox
                  checked={selectedIds.has(home.id)}
                  onChange={() => toggleSelect(home.id)}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ ml: 0.5 }}
                />
              ) : (
                <Box sx={{ width: 42, flexShrink: 0 }} />
              )
            }
            trailing={
              canDeleteHome(home) && (
                <IconButton edge="end" aria-label="home options" onClick={(e) => openMenu(e, home)} sx={{ mr: 1 }}>
                  <MoreVertIcon />
                </IconButton>
              )
            }
          />
        ))}
      </List>

      <Menu anchorEl={menuState?.anchorEl} open={!!menuState} onClose={closeMenu}>
        <MenuItem onClick={handleDeleteStart} sx={{ color: "error.main" }}>
          Delete
        </MenuItem>
      </Menu>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)}>
        <DialogTitle>Create New Home</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Pick who owns this household. Everyone the owner (or a co-owner) adds automatically gets access to
            every list assigned to it.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Home Name"
            fullWidth
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Owner</InputLabel>
            <Select value={createOwnerId} label="Owner" onChange={(e) => setCreateOwnerId(e.target.value)}>
              {allUsers.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.username}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!createName.trim() || !createOwnerId}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete home?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget &&
              `"${deleteTarget.name}" will be deleted. Lists assigned to it stay intact, just no longer shared with its members.`}
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
          Delete {selectedIds.size} home{selectedIds.size === 1 ? "" : "s"}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Lists assigned to the selected homes stay intact, just no longer shared with their members.
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

export default Homes;
