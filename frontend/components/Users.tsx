import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import List from "@mui/material/List";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { fetchCurrentUser, getCachedCurrentUser } from "../sync";
import { createUser, deleteUser, listUsers } from "../api/users";
import SearchField, { STICKY_SEARCH_SX } from "./SearchField";
import EntityRow from "./EntityRow";
import type { UserOut } from "../api/types";

const emptyForm = { username: "", password: "", confirmPassword: "", firstname: "", lastname: "" };

interface MenuState {
  anchorEl: HTMLElement;
  user: UserOut;
}

const Users = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserOut[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<UserOut | null>(getCachedCurrentUser());
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserOut | null>(null);

  const loadUsers = () =>
    listUsers()
      .then(setUsers)
      .catch((err) => console.error("Error fetching users:", err));

  useEffect(() => {
    loadUsers();
    fetchCurrentUser().then((user) => user && setCurrentUser(user));
  }, []);

  const isAdmin = !!currentUser?.admin;
  const canDeleteUser = (user: UserOut) => isAdmin && user.id !== currentUser?.id;
  const searchLower = searchQuery.trim().toLowerCase();
  const filteredUsers = users.filter(
    (u) =>
      !searchLower ||
      u.username.toLowerCase().includes(searchLower) ||
      u.firstname.toLowerCase().includes(searchLower) ||
      u.lastname.toLowerCase().includes(searchLower)
  );

  const handleCreateOpen = () => {
    setForm(emptyForm);
    setError("");
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      await createUser({
        username: form.username,
        password: form.password,
        firstname: form.firstname,
        lastname: form.lastname,
      });
      setCreateOpen(false);
      loadUsers();
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(detail || "Failed to create user");
    }
  };

  const openMenu = (event: React.MouseEvent<HTMLElement>, user: UserOut) =>
    setMenuState({ anchorEl: event.currentTarget, user });
  const closeMenu = () => setMenuState(null);

  const handleDeleteStart = () => {
    if (!menuState) return;
    setDeleteTarget(menuState.user);
    closeMenu();
  };
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteUser(deleteTarget.id);
    setDeleteTarget(null);
    loadUsers();
  };

  const toggleSelect = (id: number) =>
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
    await Promise.all(ids.map((id) => deleteUser(id)));
    loadUsers();
  };

  const selectableUsers = filteredUsers.filter(canDeleteUser);
  const toggleSelectAll = () => {
    if (selectableUsers.length > 0 && selectedIds.size === selectableUsers.length) clearSelection();
    else setSelectedIds(new Set(selectableUsers.map((u) => u.id)));
  };

  return (
    <Box component="main">
      <Stack direction="row" sx={{ gap: 1, mb: 2, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <Typography component="h1" variant="h4">
          Users
        </Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateOpen}>
            Add User
          </Button>
        )}
      </Stack>

      {selectableUsers.length > 0 && (
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1 }}>
          <Checkbox
            indeterminate={selectedIds.size > 0 && selectedIds.size < selectableUsers.length}
            checked={selectedIds.size === selectableUsers.length}
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

      {users.length > 0 && (
        <Box sx={{ ...STICKY_SEARCH_SX, mb: 1 }}>
          <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search users…" />
        </Box>
      )}

      {users.length > 0 && filteredUsers.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Typography variant="body1">No users match your search.</Typography>
        </Box>
      )}

      <List sx={{ py: 0 }}>
        {filteredUsers.map((user) => (
          <EntityRow
            key={user.id}
            onClick={() => navigate(`/user/${user.id}`)}
            primary={`${user.firstname} ${user.lastname}`}
            secondary={`@${user.username}`}
            chips={user.admin && <Chip size="small" label="Admin" color="primary" />}
            leading={
              canDeleteUser(user) ? (
                <Checkbox
                  checked={selectedIds.has(user.id)}
                  onChange={() => toggleSelect(user.id)}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ ml: 0.5 }}
                />
              ) : (
                <Box sx={{ width: 42, flexShrink: 0 }} />
              )
            }
            trailing={
              canDeleteUser(user) && (
                <IconButton edge="end" aria-label="user options" onClick={(e) => openMenu(e, user)} sx={{ mr: 1 }}>
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
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          {error && (
            <DialogContentText color="error" sx={{ mb: 1 }}>
              {error}
            </DialogContentText>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Username"
            fullWidth
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Confirm Password"
            type="password"
            fullWidth
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          />
          <TextField
            margin="dense"
            label="First Name"
            fullWidth
            value={form.firstname}
            onChange={(e) => setForm({ ...form, firstname: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Last Name"
            fullWidth
            value={form.lastname}
            onChange={(e) => setForm({ ...form, lastname: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete user?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget && `"${deleteTarget.username}" will be permanently deleted.`}
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
          Delete {selectedIds.size} user{selectedIds.size === 1 ? "" : "s"}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>The selected users will be permanently deleted.</DialogContentText>
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

export default Users;
