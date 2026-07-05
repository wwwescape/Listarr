import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import MuiList from "@mui/material/List";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Select from "@mui/material/Select";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddIcon from "@mui/icons-material/Add";
import db, { type EntityId, type ListRow } from "../db";
import * as sync from "../sync";
import { getCachedCurrentUser } from "../sync";
import { getHome } from "../api/homes";
import { listUsers } from "../api/users";
import { normalizeId } from "./List";
import EntityRow from "./EntityRow";
import type { HomeDetailOut, HomeMemberOut, UserOut } from "../api/types";

const ROLE_LABELS: Record<string, string> = { owner: "Owner", co_owner: "Co-owner", member: "Member" };
const MANAGE_ROLES = ["owner", "co_owner"];

interface MemberMenuState {
  anchorEl: HTMLElement;
  member: HomeMemberOut;
}

interface ListMenuState {
  anchorEl: HTMLElement;
  list: ListRow;
}

// Detail page for a single home — mirrors List.tsx's role as the detail
// counterpart to Lists.tsx. Member management here replaces what used to be
// Homes.tsx's "Manage members" dialog; the lists section is sourced
// straight from the already-hydrated `db.lists` (home_id is an indexed
// Dexie field) rather than a new backend endpoint, since GET /api/homes/:id
// doesn't return a home's lists.
const HomePage = () => {
  const { homeId: rawHomeId } = useParams();
  const homeId = normalizeId(rawHomeId!);
  const navigate = useNavigate();
  const currentUser = getCachedCurrentUser();
  const isAdmin = !!currentUser?.admin;

  const [detail, setDetail] = useState<HomeDetailOut | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [allUsers, setAllUsers] = useState<UserOut[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "lists">("users");

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<{ name: string; ownerId: EntityId | "" }>({ name: "", ownerId: "" });
  const [editError, setEditError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState<EntityId | "">("");
  const [addRole, setAddRole] = useState("member");

  const [memberMenu, setMemberMenu] = useState<MemberMenuState | null>(null);
  const [transferTarget, setTransferTarget] = useState<HomeMemberOut | null>(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<HomeMemberOut | null>(null);

  const [listMenu, setListMenu] = useState<ListMenuState | null>(null);
  const [removeListTarget, setRemoveListTarget] = useState<ListRow | null>(null);

  const home = useLiveQuery(() => db.homes.get(homeId), [homeId]);
  const lists = useLiveQuery(() => db.lists.where("home_id").equals(homeId).toArray(), [homeId]) || [];

  const loadDetail = async () => {
    try {
      const detailOut = await getHome(homeId as number);
      setDetail(detailOut);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => {
    sync.fetchHomes();
    sync.hydrateLists();
    listUsers()
      .then(setAllUsers)
      .catch(() => {});
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId]);

  const myRole = home?.my_role;
  const canManage = isAdmin || MANAGE_ROLES.includes(myRole || "");
  const canDeleteHome = isAdmin || myRole === "owner";

  const isSelfRow = (member: HomeMemberOut) => member.user.id === currentUser?.id;
  const canMakeOwner = (member: HomeMemberOut) => isAdmin && member.role !== "owner";
  const canMakeCoOwner = (member: HomeMemberOut) => canManage && member.role === "member";
  const canRemoveMember = (member: HomeMemberOut) => {
    if (isSelfRow(member)) return true;
    if (member.role === "owner") return isAdmin;
    return canManage;
  };
  const hasMemberActions = (member: HomeMemberOut) =>
    canMakeOwner(member) || canMakeCoOwner(member) || canRemoveMember(member);

  const eligibleUsers = allUsers.filter((u) => !detail?.members.some((m) => m.user.id === u.id));

  const openEdit = () => {
    if (!home || !detail) return;
    const currentOwner = detail.members.find((m) => m.role === "owner");
    setEditForm({ name: home.name, ownerId: currentOwner?.user.id ?? "" });
    setEditError("");
    setEditOpen(true);
  };
  const handleEditConfirm = async () => {
    if (!home || !detail) return;
    setEditError("");
    try {
      const currentOwner = detail.members.find((m) => m.role === "owner");
      if (editForm.name.trim() && editForm.name.trim() !== home.name) {
        const ok = await sync.renameHome(homeId, editForm.name.trim());
        if (!ok) {
          setEditError("Failed to rename home");
          return;
        }
      }
      if (editForm.ownerId && String(editForm.ownerId) !== String(currentOwner?.user.id ?? "")) {
        const response = await sync.transferHomeOwnership(homeId, editForm.ownerId);
        if (!response) return; // offline — sync.ts already surfaced a toast
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setEditError(body?.detail || "Failed to change owner");
          return;
        }
      }
      setEditOpen(false);
      loadDetail();
      sync.fetchHomes();
    } catch {
      setEditError("Failed to update home");
    }
  };

  const handleDeleteConfirm = async () => {
    const ok = await sync.deleteHome(homeId);
    setDeleteConfirm(false);
    if (ok) navigate("/homes");
  };

  const openAddDialog = () => {
    setAddUserId("");
    setAddRole("member");
    setAddOpen(true);
  };
  const handleAddConfirm = async () => {
    if (!addUserId) return;
    if (addRole === "owner") await sync.transferHomeOwnership(homeId, addUserId);
    else await sync.addHomeMember(homeId, addUserId, addRole);
    setAddOpen(false);
    loadDetail();
    sync.fetchHomes();
  };

  const handleRoleChange = async (userId: EntityId, role: string) => {
    await sync.updateHomeMemberRole(homeId, userId, role);
    setMemberMenu(null);
    loadDetail();
  };
  const handleTransferConfirm = async () => {
    if (!transferTarget) return;
    await sync.transferHomeOwnership(homeId, transferTarget.user.id);
    setTransferTarget(null);
    loadDetail();
    sync.fetchHomes();
  };
  const handleRemoveMemberConfirm = async () => {
    if (!removeMemberTarget) return;
    const targetUserId = removeMemberTarget.user.id;
    setRemoveMemberTarget(null);
    // Self-removal needs the local db.homes cache cleaned up explicitly —
    // fetchHomes() only adds/updates, it never removes a home that's
    // disappeared from the response (e.g. because we just lost access) —
    // and there's no point reloading this page's detail once we can no
    // longer see it.
    if (targetUserId === currentUser?.id) {
      await sync.leaveHome(homeId);
      navigate("/homes");
      return;
    }
    await sync.removeHomeMember(homeId, targetUserId);
    loadDetail();
    sync.fetchHomes();
  };

  const handleRemoveListConfirm = async () => {
    if (!removeListTarget) return;
    await sync.updateList(removeListTarget.id, { home_id: null });
    setRemoveListTarget(null);
  };

  if (loadError) {
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
        <Typography color="text.secondary">You don&apos;t have access to this home.</Typography>
        <Button onClick={() => navigate("/homes")}>Back to homes</Button>
      </Box>
    );
  }

  if (!home || !detail) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box component="main">
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate("/homes")} aria-label="back to homes">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 600 }}>
            {home.name}
          </Typography>
        </Box>
        {canManage && (
          <Button variant="outlined" onClick={openEdit}>
            Edit
          </Button>
        )}
        {canDeleteHome && (
          <Button color="error" variant="contained" onClick={() => setDeleteConfirm(true)}>
            Delete
          </Button>
        )}
      </Box>

      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 2 }}>
        <Tab label="Users" value="users" />
        <Tab label="Lists" value="lists" />
      </Tabs>

      {activeTab === "users" ? (
        <Box>
          {canManage && (
            <Box sx={{ mb: 2 }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>
                Add User
              </Button>
            </Box>
          )}
          <MuiList dense sx={{ py: 0 }}>
            {detail.members.map((member) => (
              <EntityRow
                key={member.id}
                onClick={() => navigate(`/user/${member.user.id}`)}
                primary={`${member.user.firstname} ${member.user.lastname}`}
                secondary={`@${member.user.username}`}
                chips={<Chip size="small" label={ROLE_LABELS[member.role]} />}
                trailing={
                  hasMemberActions(member) && (
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={`options for ${member.user.username}`}
                      onClick={(e) => setMemberMenu({ anchorEl: e.currentTarget, member })}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  )
                }
              />
            ))}
          </MuiList>
        </Box>
      ) : lists.length === 0 ? (
        <Typography color="text.secondary">No lists are assigned to this home yet.</Typography>
      ) : (
        <MuiList sx={{ py: 0 }}>
          {lists.map((list) => (
            <EntityRow
              key={list.id}
              onClick={() => navigate(`/list/${list.id}`)}
              primary={list.name}
              trailing={
                canManage && (
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

      <Menu anchorEl={memberMenu?.anchorEl} open={!!memberMenu} onClose={() => setMemberMenu(null)}>
        {memberMenu && canMakeOwner(memberMenu.member) && (
          <MenuItem
            onClick={() => {
              setTransferTarget(memberMenu.member);
              setMemberMenu(null);
            }}
          >
            Make Owner
          </MenuItem>
        )}
        {memberMenu && canMakeCoOwner(memberMenu.member) && (
          <MenuItem onClick={() => handleRoleChange(memberMenu.member.user.id, "co_owner")}>Make Co-Owner</MenuItem>
        )}
        {memberMenu && canRemoveMember(memberMenu.member) && (
          <MenuItem
            onClick={() => {
              setRemoveMemberTarget(memberMenu.member);
              setMemberMenu(null);
            }}
            sx={{ color: "error.main" }}
          >
            Remove from Home
          </MenuItem>
        )}
      </Menu>

      <Menu anchorEl={listMenu?.anchorEl} open={!!listMenu} onClose={() => setListMenu(null)}>
        <MenuItem
          onClick={() => {
            if (listMenu) setRemoveListTarget(listMenu.list);
            setListMenu(null);
          }}
          sx={{ color: "error.main" }}
        >
          Remove from Home
        </MenuItem>
      </Menu>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogTitle>Edit home</DialogTitle>
        <DialogContent>
          {editError && (
            <DialogContentText color="error" sx={{ mb: 1 }}>
              {editError}
            </DialogContentText>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Home Name"
            fullWidth
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Owner</InputLabel>
            <Select
              value={editForm.ownerId}
              label="Owner"
              onChange={(e) => setEditForm({ ...editForm, ownerId: e.target.value })}
            >
              {allUsers.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.username}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditConfirm}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)}>
        <DialogTitle>Add user to {home.name}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense">
            <InputLabel>User</InputLabel>
            <Select value={addUserId} label="User" onChange={(e) => setAddUserId(e.target.value)}>
              {eligibleUsers.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.username}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Role</InputLabel>
            <Select value={addRole} label="Role" onChange={(e) => setAddRole(e.target.value)}>
              <MenuItem value="owner">Owner</MenuItem>
              <MenuItem value="co_owner">Co-Owner</MenuItem>
              <MenuItem value="member">Member</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddConfirm} disabled={!addUserId}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(false)}>
        <DialogTitle>Delete home?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            &quot;{home.name}&quot; will be deleted. Lists assigned to it stay intact, just no longer shared with its
            members.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!transferTarget} onClose={() => setTransferTarget(null)}>
        <DialogTitle>Make owner?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {transferTarget &&
              `"${transferTarget.user.username}" will become the owner of "${home.name}". The current owner becomes a co-owner.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleTransferConfirm}>
            Make owner
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!removeMemberTarget} onClose={() => setRemoveMemberTarget(null)}>
        <DialogTitle>Remove member?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {removeMemberTarget &&
              `"${removeMemberTarget.user.username}" will lose access to lists shared through "${home.name}".` +
                (removeMemberTarget.role === "owner"
                  ? " Another member will automatically become the new owner."
                  : "")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveMemberTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleRemoveMemberConfirm}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!removeListTarget} onClose={() => setRemoveListTarget(null)}>
        <DialogTitle>Remove list from home?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {removeListTarget &&
              `"${removeListTarget.name}" will no longer be shared with "${home.name}"'s members. The list itself isn't deleted.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveListTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleRemoveListConfirm}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HomePage;
