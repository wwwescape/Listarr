import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import io from "socket.io-client";
import { TransitionGroup } from "react-transition-group";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { BOTTOM_NAV_HEIGHT } from "../navigation/BottomNavBar";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import MuiList from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import ButtonBase from "@mui/material/ButtonBase";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import SortIcon from "@mui/icons-material/Sort";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PrintIcon from "@mui/icons-material/Print";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import SwipeableItem from "./SwipeableItem";
import SortableItem from "./SortableItem";
import SearchField, { STICKY_SEARCH_SX } from "./SearchField";
import ItemFormSheet, { type SubmitPayload } from "./ItemFormSheet";
import EntityRow from "./EntityRow";
import ListFormDialog, { type ListFormValues } from "./ListFormDialog";
import db, { type EntityId, type ListItemRow } from "../db";
import * as sync from "../sync";
import { API_BASE_URL } from "../api/client";
import { useSettings, SORT_OPTIONS } from "../appSettings";
import { itemsToCSV, itemsToJSON, parseCSV, parseJSON, downloadFile } from "../utils/exportImport";
import { listUsers } from "../api/users";
import type { UserOut } from "../api/types";

const itemSummary = (item: ListItemRow) => {
  const parts: string[] = [];
  if (item.category?.category_name) parts.push(item.category.category_name);
  if (item.brand) parts.push(item.brand);
  if (item.priority && item.priority !== "normal") parts.push(item.priority);
  if (item.notes) parts.push(item.notes);
  return parts.join(" · ");
};

const itemLabel = (item: ListItemRow) => `${item.quantity || ""} ${item.unit || ""} ${item.name}`.trim();

const groupBy = <T,>(items: T[], keyFn: (item: T) => string | null | undefined): [string, T[]][] => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item) || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });
};

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };
const sortFlat = (items: ListItemRow[], mode: string) => {
  const copy = [...items];
  if (mode === "alpha") return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (mode === "date")
    return copy.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  if (mode === "priority")
    return copy.sort((a, b) => (PRIORITY_ORDER[a.priority || "normal"] ?? 1) - (PRIORITY_ORDER[b.priority || "normal"] ?? 1));
  if (mode === "custom") return copy.sort((a, b) => (a.position || 0) - (b.position || 0));
  return copy;
};

// URL params are always strings; Dexie keys must match the stored type
// exactly (a string "5" won't match a number 5). Server ids are numbers;
// only offline-created temp ids stay as strings.
export const normalizeId = (id: EntityId): EntityId => {
  if (typeof id !== "string" || id.startsWith("temp-")) return id;
  const n = Number(id);
  return Number.isNaN(n) ? id : n;
};

const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return isOnline;
};

interface DuplicatePrompt {
  payload: SubmitPayload;
  existingItem: ListItemRow;
}

const ListPage = () => {
  const { listId: rawListId } = useParams();
  const listId = normalizeId(rawListId!);
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [settings] = useSettings();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("sm"));

  const [activeTab, setActiveTab] = useState<"items" | "users">("items");
  const [allUsers, setAllUsers] = useState<UserOut[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"add" | "edit">("add");
  const [editingItem, setEditingItem] = useState<ListItemRow | null>(null);
  const [itemDeleteTarget, setItemDeleteTarget] = useState<ListItemRow | null>(null);
  const [checkedExpanded, setCheckedExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePrompt | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteListConfirm, setDeleteListConfirm] = useState(false);
  const [listUserMenu, setListUserMenu] = useState<{ anchorEl: HTMLElement; user: UserOut } | null>(null);
  const [removeCollaboratorTarget, setRemoveCollaboratorTarget] = useState<UserOut | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | checked | favourite
  const [categoryFilter, setCategoryFilter] = useState<EntityId | "all">("all");
  const [sortMode, setSortMode] = useState(settings.defaultSort);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showError = (message: string) => setErrorMessage(message);

  // The UI's only source of truth is IndexedDB — these re-render whenever
  // Dexie changes, whether from a local optimistic write, a socket push, or
  // a server hydration. No manual "refetch and setState" anywhere below.
  const list = useLiveQuery(() => db.lists.get(listId), [listId]);
  const items = useLiveQuery(() => db.listItems.where("list_id").equals(listId).toArray(), [listId]) || [];
  const catalogItems = useLiveQuery(() => db.catalogItems.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const areas = useLiveQuery(() => db.areas.toArray()) || [];
  const homes = useLiveQuery(() => db.homes.toArray()) || [];
  const pendingSyncCount =
    useLiveQuery(() => db.outbox.where("listId").equals(listId).count(), [listId]) || 0;

  const currentUser = sync.getCachedCurrentUser();
  // Placing a list into a household requires being that household's owner
  // or co-owner (or an Admin) — matches Lists.tsx.
  const assignableHomes = homes.filter(
    (h) => currentUser?.admin || h.my_role === "owner" || h.my_role === "co_owner"
  );
  // Deleting is narrower than viewing/editing (matches the backend's
  // can_delete_list and Lists.tsx's own gate): admin, the list's creator, or
  // the owner of the home it's assigned to.
  const canDeleteList =
    !!list &&
    (!!currentUser?.admin ||
      (!!currentUser && String(list.createdBy) === String(currentUser.id)) ||
      (!!list.home_id && homes.find((h) => h.id === list.home_id)?.my_role === "owner"));

  const itemOptions = useMemo(
    () => catalogItems.map((i) => ({ value: i.id, label: i.item_name, categoryId: i.category_id ?? null })),
    [catalogItems]
  );
  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c.id, label: c.category_name })), [categories]);
  const areaOptions = useMemo(() => areas.map((a) => ({ value: a.id, label: a.area_name })), [areas]);

  // For the Users tab — resolving list.createdBy/collaborators (raw ids)
  // into display names. listUsers() (not getCollaborators(), which
  // deliberately excludes the caller) so the creator still resolves when
  // that happens to be the current user.
  useEffect(() => {
    listUsers()
      .then(setAllUsers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    sync.hydrateList(listId);
    sync.hydrateCatalog();
    sync.fetchHomes();
    sync.recordListOpened(listId);

    const socket = io(API_BASE_URL);
    socket.on("connect", () => {
      sync.setCurrentSocketId(socket.id ?? null);
      socket.emit("joinList", listId);
      // Reconnect = a good moment to drain anything queued while offline
      // and re-pull authoritative state (cheaper and more correct than
      // trying to merge missed socket events from while we were away).
      sync.drainOutbox();
      sync.hydrateList(listId);
    });
    socket.on("itemAdded", (data: { list_id: EntityId; item: ListItemRow }) => {
      if (String(data.list_id) === String(listId)) sync.applyRemoteItem(data.item);
    });
    socket.on("itemUpdated", (data: { list_id: EntityId; item: ListItemRow }) => {
      if (String(data.list_id) === String(listId)) sync.applyRemoteItem(data.item);
    });
    socket.on("itemDeleted", (data: { list_id: EntityId; item_id: EntityId }) => {
      if (String(data.list_id) === String(listId)) sync.removeRemoteItem(data.item_id);
    });

    const onConflict = (event: Event) => showError((event as CustomEvent).detail.message);
    const onFailed = (event: Event) => showError((event as CustomEvent).detail.message);
    sync.syncEvents.addEventListener("conflict", onConflict);
    sync.syncEvents.addEventListener("failed", onFailed);

    return () => {
      socket.emit("leaveList", listId);
      socket.disconnect();
      sync.syncEvents.removeEventListener("conflict", onConflict);
      sync.syncEvents.removeEventListener("failed", onFailed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, listId]);

  const handleToggleChecked = (item: ListItemRow) => sync.updateListItem(listId, item.id, { checked: !item.checked });
  const handleToggleFavourite = (item: ListItemRow) => sync.updateListItem(listId, item.id, { favourite: !item.favourite });
  // Deleting an item always goes through the confirm dialog below — the
  // icon button, the swipe-left gesture, and the ItemFormSheet's Delete
  // button (see handleSheetDelete) all just set this target instead of
  // deleting directly.
  const handleDeleteItem = (item: ListItemRow) => setItemDeleteTarget(item);
  const confirmDeleteItem = async () => {
    if (!itemDeleteTarget) return;
    await sync.deleteListItem(listId, itemDeleteTarget.id);
    setItemDeleteTarget(null);
  };

  const openAddSheet = () => {
    setSheetMode("add");
    setEditingItem(null);
    setSheetOpen(true);
  };

  const openEditSheet = (item: ListItemRow) => {
    setSheetMode("edit");
    setEditingItem(item);
    setSheetOpen(true);
  };

  const handleSheetSubmit = async (payload: SubmitPayload) => {
    if (sheetMode === "edit" && editingItem) {
      await sync.updateListItem(listId, editingItem.id, payload);
      return;
    }

    // Warn before adding a name that's already pending on this list, rather
    // than silently creating a second row the user probably didn't intend.
    const existingItem = items.find(
      (i) => !i.checked && i.name.trim().toLowerCase() === payload.name.trim().toLowerCase()
    );
    if (existingItem) {
      setDuplicatePrompt({ payload, existingItem });
      return;
    }

    await sync.createListItem(listId, payload);
  };

  const handleDuplicateMerge = async () => {
    if (!duplicatePrompt) return;
    const { payload, existingItem } = duplicatePrompt;
    setDuplicatePrompt(null);
    await sync.updateListItem(listId, existingItem.id, {
      quantity: (existingItem.quantity || 0) + (payload.quantity || 1),
    });
  };

  const handleDuplicateKeepBoth = async () => {
    if (!duplicatePrompt) return;
    const { payload } = duplicatePrompt;
    setDuplicatePrompt(null);
    await sync.createListItem(listId, payload);
  };

  const handleDuplicateCancel = () => setDuplicatePrompt(null);

  const handleSheetDelete = () => {
    setSheetOpen(false);
    if (editingItem) setItemDeleteTarget(editingItem);
  };

  const handleEditSave = async (values: ListFormValues) => {
    await sync.updateList(listId, { name: values.name, collaborators: values.collaborators, home_id: values.home_id });
    setEditOpen(false);
  };

  const handleDeleteListConfirm = async () => {
    await sync.deleteList(listId);
    navigate("/lists");
  };

  const handleRemoveCollaboratorConfirm = async () => {
    if (!removeCollaboratorTarget || !list) return;
    await sync.removeListCollaborator(listId, removeCollaboratorTarget.id, list.collaborators || []);
    setRemoveCollaboratorTarget(null);
  };

  // --- Search + filter -----------------------------------------------------
  const searchLower = searchQuery.trim().toLowerCase();
  const matchesSearch = (item: ListItemRow) =>
    !searchLower ||
    item.name.toLowerCase().includes(searchLower) ||
    (item.notes || "").toLowerCase().includes(searchLower) ||
    (item.category?.category_name || "").toLowerCase().includes(searchLower) ||
    (item.area?.area_name || "").toLowerCase().includes(searchLower);
  const matchesStatus = (item: ListItemRow) => {
    if (statusFilter === "pending") return !item.checked;
    if (statusFilter === "checked") return item.checked;
    if (statusFilter === "favourite") return item.favourite;
    return true;
  };
  const matchesCategory = (item: ListItemRow) => categoryFilter === "all" || item.category_id === categoryFilter;
  const filteredItems = items.filter((i) => matchesSearch(i) && matchesStatus(i) && matchesCategory(i));

  const pendingItems = filteredItems.filter((item) => !item.checked);
  const checkedItems = filteredItems.filter((item) => item.checked);

  // --- Sort / group ----------------------------------------------------------
  const groupedPending = useMemo(() => {
    if (sortMode === "area") return groupBy(pendingItems, (i) => i.area?.area_name);
    if (sortMode === "category") return groupBy(pendingItems, (i) => i.category?.category_name);
    return [[null, sortFlat(pendingItems, sortMode)]] as [string | null, ListItemRow[]][];
  }, [pendingItems, sortMode]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ordered = sortFlat(pendingItems, "custom");
    const oldIndex = ordered.findIndex((i) => i.id === active.id);
    const newIndex = ordered.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(ordered, oldIndex, newIndex);
    await Promise.all(reordered.map((item, index) => sync.updateListItem(listId, item.id, { position: index })));
  };

  // --- Export / import / print ------------------------------------------------
  const closeMoreMenu = () => setMoreMenuAnchor(null);

  const handleExport = (format: "csv" | "json") => {
    closeMoreMenu();
    const filename = `${list!.name.replace(/[^\w\- ]/g, "")}.${format}`;
    if (format === "csv") downloadFile(filename, itemsToCSV(items), "text/csv");
    else downloadFile(filename, itemsToJSON(items), "application/json");
  };

  const handlePrint = () => {
    closeMoreMenu();
    window.print();
  };

  const handleImportClick = () => {
    closeMoreMenu();
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    try {
      const text = await file.text();
      const rows = file.name.toLowerCase().endsWith(".json") ? parseJSON(text) : parseCSV(text);
      for (const row of rows) {
        let categoryId: EntityId | null = null;
        if (row.category) {
          const existing = categoryOptions.find((c) => c.label.toLowerCase() === row.category.toLowerCase());
          categoryId = existing ? existing.value : await sync.createCategory(row.category);
        }
        let areaId: EntityId | null = null;
        if (row.area) {
          const existing = areaOptions.find((a) => a.label.toLowerCase() === row.area.toLowerCase());
          areaId = existing ? existing.value : await sync.createArea(row.area);
        }
        await sync.createListItem(listId, {
          item_id: null,
          name: row.name,
          quantity: row.quantity,
          unit: row.unit,
          notes: row.notes,
          category_id: categoryId,
          area_id: areaId,
          priority: row.priority,
          brand: row.brand,
          favourite: !!row.favourite,
        });
      }
      if (rows.length === 0) showError("That file didn't contain any recognizable items.");
    } catch (error) {
      console.error("Error importing file:", error);
      showError("Couldn't import that file — check it's a valid CSV or JSON export.");
    }
  };

  if (!list) {
    if (!isOnline) {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 1 }}>
          <CloudOffIcon color="disabled" fontSize="large" />
          <Typography color="text.secondary">You&apos;re offline and this list hasn&apos;t been downloaded yet.</Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  const renderItemContent = (item: ListItemRow, checked: boolean) => (
    <ListItem
      secondaryAction={
        <Box className="no-print" sx={{ display: "flex", gap: 1 }}>
          {!checked && (
            <IconButton edge="end" aria-label="favourite" onClick={() => handleToggleFavourite(item)}>
              {item.favourite ? <StarIcon color="warning" /> : <StarBorderIcon />}
            </IconButton>
          )}
          <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteItem(item)}>
            <DeleteIcon />
          </IconButton>
        </Box>
      }
    >
      <ListItemIcon className="no-print">
        <Checkbox edge="start" checked={!!item.checked} onChange={() => handleToggleChecked(item)} />
      </ListItemIcon>
      <ButtonBase
        onClick={() => openEditSheet(item)}
        sx={{ flexGrow: 1, justifyContent: "flex-start", textAlign: "left", borderRadius: 1, py: 0.5 }}
      >
        <ListItemText
          primary={itemLabel(item)}
          secondary={itemSummary(item)}
          slotProps={{
            primary: checked ? { sx: { textDecoration: "line-through", color: "text.disabled" } } : undefined,
            secondary: checked ? { sx: { color: "text.disabled" } } : undefined,
          }}
        />
      </ButtonBase>
    </ListItem>
  );

  const renderItem = (item: ListItemRow, checked: boolean) =>
    sortMode === "custom" && !checked ? (
      <SortableItem key={item.id} id={item.id}>
        {renderItemContent(item, checked)}
      </SortableItem>
    ) : (
      <SwipeableItem key={item.id} onSwipeRight={() => handleToggleChecked(item)} onSwipeLeft={() => handleDeleteItem(item)}>
        {renderItemContent(item, checked)}
      </SwipeableItem>
    );

  const pendingList = groupedPending[0]?.[1] || [];

  return (
    <Box component="main" sx={{ pb: 10 }}>
      <style>{"@media print { .no-print { display: none !important; } }"}</style>

      <Box className="no-print" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate("/lists")} aria-label="back to lists">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 600 }}>
            {list.name}
          </Typography>
          {(list.home || pendingSyncCount > 0) && (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
              {list.home && <Chip size="small" label={list.home.name} />}
              {pendingSyncCount > 0 && (
                <Chip size="small" color="primary" variant="outlined" label={`${pendingSyncCount} syncing`} />
              )}
            </Box>
          )}
        </Box>
        <Button variant="outlined" onClick={() => setEditOpen(true)} className="no-print">
          Edit
        </Button>
        {canDeleteList && (
          <Button
            color="error"
            variant="contained"
            onClick={() => setDeleteListConfirm(true)}
            className="no-print"
          >
            Delete
          </Button>
        )}
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 600, display: "none" }} className="print-only-title">
        {list.name}
      </Typography>

      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} className="no-print" sx={{ mb: 2 }}>
        <Tab label="Items" value="items" />
        <Tab label="Users" value="users" />
      </Tabs>

      {activeTab === "users" ? (
        <Box>
          {list.home && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Also shared with everyone in the &quot;{list.home.name}&quot; household.
            </Typography>
          )}
          <MuiList sx={{ py: 0 }}>
            {(() => {
              const creator = allUsers.find((u) => String(u.id) === String(list.createdBy));
              const collaboratorUsers = (list.collaborators || [])
                .map((id) => allUsers.find((u) => String(u.id) === String(id)))
                .filter((u): u is UserOut => Boolean(u));
              const rows = [
                ...(creator ? [{ user: creator, label: "Creator", isCreator: true }] : []),
                ...collaboratorUsers.map((user) => ({ user, label: "Collaborator", isCreator: false })),
              ];
              if (rows.length === 0) {
                return (
                  <Typography color="text.secondary">
                    No other users are directly associated with this list.
                  </Typography>
                );
              }
              return rows.map(({ user, label, isCreator }) => (
                <EntityRow
                  key={`${label}-${user.id}`}
                  onClick={() => navigate(`/user/${user.id}`)}
                  primary={`${user.firstname} ${user.lastname}`}
                  secondary={`@${user.username}`}
                  chips={<Chip size="small" label={label} />}
                  trailing={
                    !isCreator && (
                      <IconButton
                        edge="end"
                        aria-label={`options for ${user.username}`}
                        onClick={(e) => setListUserMenu({ anchorEl: e.currentTarget, user })}
                        sx={{ mr: 1 }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    )
                  }
                />
              ));
            })()}
          </MuiList>
        </Box>
      ) : (
        <>
          <Paper variant="outlined" className="no-print" sx={{ ...STICKY_SEARCH_SX, bgcolor: "background.paper", p: 2, mb: 2 }}>
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search items, notes, category, area…"
              sx={{ mb: 1.5 }}
            />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              {["all", "pending", "checked", "favourite"].map((value) => (
                <Chip
                  key={value}
                  size="small"
                  label={value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1)}
                  color={statusFilter === value ? "primary" : "default"}
                  variant={statusFilter === value ? "filled" : "outlined"}
                  onClick={() => setStatusFilter(value)}
                />
              ))}
              {categoryOptions.length > 0 && (
                <TextField
                  select
                  size="small"
                  variant="standard"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  sx={{ minWidth: 110 }}
                >
                  <MenuItem value="all">Any category</MenuItem>
                  {categoryOptions.map((c) => (
                    <MenuItem key={c.value} value={c.value}>
                      {c.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <Box sx={{ flexGrow: 1 }} />
              <IconButton size="small" onClick={(e) => setSortMenuAnchor(e.currentTarget)} aria-label="sort">
                <SortIcon />
              </IconButton>
              <IconButton size="small" onClick={(e) => setMoreMenuAnchor(e.currentTarget)} aria-label="more actions">
                <MoreVertIcon />
              </IconButton>
            </Box>
          </Paper>

          {!isCompact && (
            <Box sx={{ mb: 2 }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openAddSheet} className="no-print">
                Add item
              </Button>
            </Box>
          )}

          {items.length === 0 && (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <Typography variant="body1">This list is empty.</Typography>
              <Typography variant="body2">Tap the + button to add your first item.</Typography>
            </Box>
          )}
          {items.length > 0 && filteredItems.length === 0 && (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <Typography variant="body1">No items match your search/filters.</Typography>
            </Box>
          )}

          {sortMode === "custom" ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pendingList.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <MuiList>
              {pendingList.map((item) => (
                <Box key={item.id} sx={{ mb: 0.5 }}>
                  {renderItem(item, false)}
                </Box>
              ))}
            </MuiList>
          </SortableContext>
        </DndContext>
      ) : (
        groupedPending.map(([groupName, groupItems]) => (
          <Box key={groupName || "flat"} sx={{ mb: 1 }}>
            <MuiList
              subheader={
                groupName && (
                  <ListSubheader disableSticky sx={{ bgcolor: "transparent", fontWeight: 600, lineHeight: 2.5 }}>
                    {groupName}
                  </ListSubheader>
                )
              }
            >
              <TransitionGroup>
                {groupItems.map((item) => (
                  <Collapse key={item.id}>{renderItem(item, false)}</Collapse>
                ))}
              </TransitionGroup>
            </MuiList>
          </Box>
        ))
      )}

      {checkedItems.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <ButtonBase
            className="no-print"
            onClick={() => setCheckedExpanded((v) => !v)}
            sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.5, borderRadius: 1 }}
          >
            <ExpandMoreIcon
              fontSize="small"
              sx={{ transform: checkedExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
            />
            <Typography variant="subtitle2" color="text.secondary">
              Checked ({checkedItems.length})
            </Typography>
          </ButtonBase>
          <Collapse in={checkedExpanded} className="print-force-visible">
            <MuiList>
              <TransitionGroup>
                {checkedItems.map((item) => (
                  <Collapse key={item.id}>{renderItem(item, true)}</Collapse>
                ))}
              </TransitionGroup>
            </MuiList>
          </Collapse>
        </Box>
      )}
        </>
      )}

      {isCompact && activeTab === "items" && (
        <Fab
          color="primary"
          aria-label="add item"
          onClick={openAddSheet}
          className="no-print"
          sx={{ position: "fixed", bottom: BOTTOM_NAV_HEIGHT + 24, right: 24 }}
        >
          <AddIcon />
        </Fab>
      )}

      <ItemFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        mode={sheetMode}
        initialItem={editingItem}
        itemOptions={itemOptions}
        categoryOptions={categoryOptions}
        areaOptions={areaOptions}
        onCreateCategory={sync.createCategory}
        onCreateArea={sync.createArea}
        onCreateCatalogItem={sync.createCatalogItem}
        onSubmit={handleSheetSubmit}
        onDelete={handleSheetDelete}
      />

      <Menu anchorEl={sortMenuAnchor} open={!!sortMenuAnchor} onClose={() => setSortMenuAnchor(null)}>
        {SORT_OPTIONS.map((opt) => (
          <MenuItem
            key={opt.value}
            selected={sortMode === opt.value}
            onClick={() => {
              setSortMode(opt.value);
              setSortMenuAnchor(null);
            }}
          >
            {opt.label}
          </MenuItem>
        ))}
      </Menu>

      <Menu anchorEl={moreMenuAnchor} open={!!moreMenuAnchor} onClose={closeMoreMenu}>
        <MenuItem onClick={handlePrint}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          Print
        </MenuItem>
        <MenuItem onClick={() => handleExport("csv")}>
          <ListItemIcon>
            <FileDownloadIcon fontSize="small" />
          </ListItemIcon>
          Export CSV
        </MenuItem>
        <MenuItem onClick={() => handleExport("json")}>
          <ListItemIcon>
            <FileDownloadIcon fontSize="small" />
          </ListItemIcon>
          Export JSON
        </MenuItem>
        <MenuItem onClick={handleImportClick}>
          <ListItemIcon>
            <FileUploadIcon fontSize="small" />
          </ListItemIcon>
          Import CSV/JSON
        </MenuItem>
      </Menu>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,application/json,text/csv"
        style={{ display: "none" }}
        onChange={handleImportFile}
      />

      <Snackbar open={!!errorMessage} autoHideDuration={4000} onClose={() => setErrorMessage("")}>
        <Alert severity="error" onClose={() => setErrorMessage("")} sx={{ width: "100%" }}>
          {errorMessage}
        </Alert>
      </Snackbar>

      <Dialog open={!!duplicatePrompt} onClose={handleDuplicateCancel}>
        <DialogTitle>Already on your list</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {duplicatePrompt &&
              `You already have "${duplicatePrompt.existingItem.name}" on this list. Merge the quantities, or keep both as separate items?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDuplicateCancel}>Cancel</Button>
          <Button onClick={handleDuplicateKeepBoth}>Keep both</Button>
          <Button variant="contained" onClick={handleDuplicateMerge} autoFocus>
            Merge
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!itemDeleteTarget} onClose={() => setItemDeleteTarget(null)}>
        <DialogTitle>Delete item?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {itemDeleteTarget && `"${itemLabel(itemDeleteTarget)}" will be removed from this list.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDeleteItem}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Menu anchorEl={listUserMenu?.anchorEl} open={!!listUserMenu} onClose={() => setListUserMenu(null)}>
        <MenuItem
          onClick={() => {
            if (listUserMenu) setRemoveCollaboratorTarget(listUserMenu.user);
            setListUserMenu(null);
          }}
          sx={{ color: "error.main" }}
        >
          Remove from List
        </MenuItem>
      </Menu>

      <ListFormDialog
        open={editOpen}
        mode="edit"
        initialValues={{
          name: list.name,
          collaborators: list.collaborators || [],
          home_id: list.home_id ?? null,
        }}
        allCollaborators={allUsers}
        assignableHomes={assignableHomes}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditSave}
      />

      <Dialog open={deleteListConfirm} onClose={() => setDeleteListConfirm(false)}>
        <DialogTitle>Delete list?</DialogTitle>
        <DialogContent>
          <DialogContentText>&quot;{list.name}&quot; and all its items will be permanently deleted.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteListConfirm(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteListConfirm}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!removeCollaboratorTarget} onClose={() => setRemoveCollaboratorTarget(null)}>
        <DialogTitle>Remove from list?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {removeCollaboratorTarget &&
              `"${removeCollaboratorTarget.username}" will lose access to "${list.name}".`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveCollaboratorTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleRemoveCollaboratorConfirm}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ListPage;
