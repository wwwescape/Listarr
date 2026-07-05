import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import MuiList from "@mui/material/List";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import * as sync from "../sync";
import { getCachedCurrentUser } from "../sync";
import { listUsers, updateUser, deleteUser, getUserHomes, getUserLists } from "../api/users";
import { normalizeId } from "./List";
import EntityRow from "./EntityRow";
import type { HomeMembershipOut, ListOut, UserOut } from "../api/types";

const ROLE_LABELS: Record<string, string> = { owner: "Owner", co_owner: "Co-owner", member: "Member" };

interface HomeMenuState {
  anchorEl: HTMLElement;
  home: HomeMembershipOut;
}

interface ListMenuState {
  anchorEl: HTMLElement;
  list: ListOut;
}

// Detail page for a single user — Edit/Delete replace what used to be
// Users.tsx's per-row "..." menu (rename/delete), moved here the same way
// Homes.tsx's "Manage members" dialog moved into Home.tsx. Homes/Lists tabs
// are gated to the viewer being this user or an Admin (the backend enforces
// the same on GET /api/users/:id/homes|lists) — everyone else just sees the
// name/username, same info already visible in the Users list.
const UserPage = () => {
  const { userId: rawUserId } = useParams();
  const userId = Number(normalizeId(rawUserId!));
  const navigate = useNavigate();
  const currentUser = getCachedCurrentUser();
  const isAdmin = !!currentUser?.admin;
  const isSelf = currentUser?.id === userId;
  const canView = isAdmin || isSelf;
  const canEdit = isAdmin || isSelf;
  const canDelete = isAdmin && !isSelf;

  const [user, setUser] = useState<UserOut | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<"homes" | "lists">("homes");
  const [homes, setHomes] = useState<HomeMembershipOut[] | null>(null);
  const [lists, setLists] = useState<ListOut[] | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ username: "", firstname: "", lastname: "" });
  const [editError, setEditError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [homeMenu, setHomeMenu] = useState<HomeMenuState | null>(null);
  const [exitHomeTarget, setExitHomeTarget] = useState<HomeMembershipOut | null>(null);
  const [listMenu, setListMenu] = useState<ListMenuState | null>(null);
  const [exitListTarget, setExitListTarget] = useState<ListOut | null>(null);

  const loadUser = () => {
    listUsers()
      .then((all) => {
        const found = all.find((u) => u.id === userId);
        if (found) setUser(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  };
  const loadHomes = () => {
    if (!canView) return;
    getUserHomes(userId)
      .then(setHomes)
      .catch(() => setHomes([]));
  };
  const loadLists = () => {
    if (!canView) return;
    getUserLists(userId)
      .then(setLists)
      .catch(() => setLists([]));
  };

  useEffect(() => {
    loadUser();
    loadHomes();
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const openEdit = () => {
    if (!user) return;
    setEditForm({ username: user.username, firstname: user.firstname, lastname: user.lastname });
    setEditError("");
    setEditOpen(true);
  };
  const handleEditConfirm = async () => {
    try {
      await updateUser(userId, editForm);
      setEditOpen(false);
      loadUser();
      if (isSelf) sync.fetchCurrentUser();
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setEditError(typeof detail === "string" ? detail : "Failed to update user");
    }
  };

  const handleDeleteConfirm = async () => {
    await deleteUser(userId);
    navigate("/users");
  };

  const handleExitHomeConfirm = async () => {
    if (!exitHomeTarget) return;
    // Self-exit needs the local db.homes cache cleaned up explicitly —
    // fetchHomes() only adds/updates, it never removes a home that's
    // disappeared from the response (e.g. because we just lost access).
    if (isSelf) await sync.leaveHome(exitHomeTarget.id);
    else await sync.removeHomeMember(exitHomeTarget.id, userId);
    setExitHomeTarget(null);
    loadHomes();
    sync.fetchHomes();
  };

  const handleExitListConfirm = async () => {
    if (!exitListTarget) return;
    await sync.removeListCollaborator(exitListTarget.id, userId, exitListTarget.collaborators || []);
    setExitListTarget(null);
    loadLists();
  };

  if (notFound) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "50vh",
          gap: 1,
        }}
      >
        <Typography color="text.secondary">That user couldn&apos;t be found.</Typography>
        <Button onClick={() => navigate("/users")}>Back to users</Button>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box component="main">
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate("/users")} aria-label="back to users">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 600 }}>
            {user.firstname} {user.lastname}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            @{user.username}
          </Typography>
          {user.admin && (
            <Box sx={{ mt: 0.5 }}>
              <Chip size="small" label="Admin" color="primary" />
            </Box>
          )}
        </Box>
        {canEdit && (
          <Button variant="outlined" onClick={openEdit}>
            Edit
          </Button>
        )}
        {canDelete && (
          <Button color="error" variant="contained" onClick={() => setDeleteConfirm(true)}>
            Delete
          </Button>
        )}
      </Box>

      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 2 }}>
        <Tab label="Homes" value="homes" />
        <Tab label="Lists" value="lists" />
      </Tabs>

      {!canView ? (
        <Typography color="text.secondary">You don&apos;t have permission to view this.</Typography>
      ) : activeTab === "homes" ? (
        homes === null ? (
          <CircularProgress size={24} />
        ) : homes.length === 0 ? (
          <Typography color="text.secondary">Not a member of any home.</Typography>
        ) : (
          <MuiList sx={{ py: 0 }}>
            {homes.map((home) => (
              <EntityRow
                key={home.id}
                onClick={() => navigate(`/home/${home.id}`)}
                primary={home.name}
                chips={<Chip size="small" label={ROLE_LABELS[home.role] || home.role} />}
                trailing={
                  home.role !== "owner" && (
                    <IconButton
                      edge="end"
                      aria-label="home options"
                      onClick={(e) => setHomeMenu({ anchorEl: e.currentTarget, home })}
                      sx={{ mr: 1 }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  )
                }
              />
            ))}
          </MuiList>
        )
      ) : lists === null ? (
        <CircularProgress size={24} />
      ) : lists.length === 0 ? (
        <Typography color="text.secondary">Not associated with any list.</Typography>
      ) : (
        <MuiList sx={{ py: 0 }}>
          {lists.map((list) => (
            <EntityRow
              key={list.id}
              onClick={() => navigate(`/list/${list.id}`)}
              primary={list.name}
              chips={list.home && <Chip size="small" label={list.home.name} />}
              trailing={
                String(list.createdBy) !== String(userId) && (
                  <IconButton
                    edge="end"
                    aria-label="list options"
                    onClick={(e) => setListMenu({ anchorEl: e.currentTarget, list })}
                    sx={{ mr: 1 }}
                  >
                    <MoreVertIcon />
                  </IconButton>
                )
              }
            />
          ))}
        </MuiList>
      )}

      <Menu anchorEl={homeMenu?.anchorEl} open={!!homeMenu} onClose={() => setHomeMenu(null)}>
        <MenuItem
          onClick={() => {
            if (homeMenu) setExitHomeTarget(homeMenu.home);
            setHomeMenu(null);
          }}
          sx={{ color: "error.main" }}
        >
          Exit Home
        </MenuItem>
      </Menu>

      <Menu anchorEl={listMenu?.anchorEl} open={!!listMenu} onClose={() => setListMenu(null)}>
        <MenuItem
          onClick={() => {
            if (listMenu) setExitListTarget(listMenu.list);
            setListMenu(null);
          }}
          sx={{ color: "error.main" }}
        >
          Exit List
        </MenuItem>
      </Menu>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogTitle>Edit user</DialogTitle>
        <DialogContent>
          {editError && (
            <DialogContentText color="error" sx={{ mb: 1 }}>
              {editError}
            </DialogContentText>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Username"
            fullWidth
            value={editForm.username}
            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
          />
          <TextField
            margin="dense"
            label="First Name"
            fullWidth
            value={editForm.firstname}
            onChange={(e) => setEditForm({ ...editForm, firstname: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Last Name"
            fullWidth
            value={editForm.lastname}
            onChange={(e) => setEditForm({ ...editForm, lastname: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditConfirm}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)}>
        <DialogTitle>Delete user?</DialogTitle>
        <DialogContent>
          <DialogContentText>&quot;{user.username}&quot; will be permanently deleted.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!exitHomeTarget} onClose={() => setExitHomeTarget(null)}>
        <DialogTitle>Exit home?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {exitHomeTarget &&
              `"${user.firstname} ${user.lastname}" will lose access to lists shared through "${exitHomeTarget.name}".`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExitHomeTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleExitHomeConfirm}>
            Exit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!exitListTarget} onClose={() => setExitListTarget(null)}>
        <DialogTitle>Exit list?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {exitListTarget && `"${user.firstname} ${user.lastname}" will be removed from "${exitListTarget.name}".`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExitListTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleExitListConfirm}>
            Exit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserPage;
