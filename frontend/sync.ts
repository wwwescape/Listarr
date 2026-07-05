import { API_BASE_URL } from "./api/client";
import { tokenStorage } from "./api/tokenStorage";
import db, { type EntityId, type HomeRow, type ListItemRow, type ListRow, type OutboxEntry } from "./db";

// Lightweight pub/sub for surfacing sync outcomes the UI should know about
// (a queued change that turned out to conflict with something deleted
// elsewhere, or that permanently failed) without wiring a new state
// management library through every component.
export const syncEvents = new EventTarget();
const notify = (type: string, detail: unknown) => syncEvents.dispatchEvent(new CustomEvent(type, { detail }));

// Set by whichever component currently owns the socket connection (List.jsx)
// so mutations can carry X-Socket-Id and skip their own echo, same as Phase 3.
let currentSocketId: string | null = null;
export const setCurrentSocketId = (id: string | null) => {
  currentSocketId = id;
};

// Prod: frontend and API share an origin (FastAPI serves the build — see
// main.py), so API_BASE_URL resolves to window.location.origin (a same-origin
// no-op prefix). Dev: the Vite dev server (:3000) and the API (:8000) are
// cross-origin — see api/client.ts — so every relative path here needs that
// prefix explicitly.
// Auth is a Bearer access token (see api/tokenStorage.ts), not a
// cookie — unlike api/client.ts's axios instance, this raw-fetch
// wrapper doesn't auto-refresh on a 401; an expired token here just fails
// and falls through to the outbox's own retry/backoff (see drainOutbox
// below).
const authFetch = (path: string, options: RequestInit = {}) => {
  const token = tokenStorage.getAccessToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(currentSocketId ? { "X-Socket-Id": currentSocketId } : {}),
      ...options.headers,
    },
  });
};

const makeTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isTempId = (id: EntityId | null | undefined): id is string =>
  typeof id === "string" && id.startsWith("temp-");

// Auth tokens (see services/tokenStorage.ts) only ever proved *whether*
// someone was logged in, never *who* — needed here so the UI can gate
// admin-only actions (e.g. deleting a user) on the current user's own
// `admin` flag.
// Cached in localStorage so it survives reloads without a network
// round-trip on every render; refreshed once per app load from AppShell.
export async function fetchCurrentUser() {
  if (!navigator.onLine) return null;
  try {
    const response = await authFetch("/api/auth/me");
    if (!response.ok) return null;
    const user = await response.json();
    localStorage.setItem("currentUser", JSON.stringify(user));
    return user;
  } catch (error) {
    console.error("Error fetching current user:", error);
    return null;
  }
}

export function getCachedCurrentUser() {
  try {
    const raw = localStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hydration: pull server state into IndexedDB. The UI never reads fetch
// responses directly — it reads Dexie via live queries, so writing here is
// what makes data show up.
// ---------------------------------------------------------------------------

export async function hydrateCatalog() {
  if (!navigator.onLine) return;
  try {
    const [categories, areas, items] = await Promise.all([
      authFetch("/api/categories").then((r) => (r.ok ? r.json() : [])),
      authFetch("/api/areas").then((r) => (r.ok ? r.json() : [])),
      authFetch("/api/items").then((r) => (r.ok ? r.json() : [])),
    ]);
    await db.transaction("rw", db.categories, db.areas, db.catalogItems, async () => {
      if (categories.length) await db.categories.bulkPut(categories);
      if (areas.length) await db.areas.bulkPut(areas);
      if (items.length) await db.catalogItems.bulkPut(items);
    });
  } catch (error) {
    console.error("Error hydrating catalog:", error);
  }
}

export async function hydrateLists() {
  if (!navigator.onLine) return;
  try {
    const response = await authFetch("/api/lists");
    if (!response.ok) return;
    const serverLists: ListRow[] = await response.json();
    // Merge, don't overwrite: a list created offline (temp id, still in the
    // outbox) isn't on the server yet and shouldn't be wiped by hydration.
    await db.transaction("rw", db.lists, async () => {
      const localOnly = await db.lists.filter((l) => isTempId(l.id)).toArray();
      await db.lists.clear();
      await db.lists.bulkPut([...serverLists, ...localOnly]);
    });
  } catch (error) {
    console.error("Error hydrating lists:", error);
  }
}

export async function hydrateList(listId: EntityId) {
  if (!navigator.onLine) return;
  try {
    const response = await authFetch(`/api/lists/list/${listId}`);
    if (!response.ok) return;
    const data = await response.json();
    const { listItems, ...listFields } = data;
    await db.transaction("rw", db.lists, db.listItems, async () => {
      await db.lists.put(listFields);
      const localOnlyItems = await db.listItems
        .where("list_id")
        .equals(listId)
        .filter((i) => isTempId(i.id))
        .toArray();
      await db.listItems.where("list_id").equals(listId).delete();
      await db.listItems.bulkPut([...(listItems as ListItemRow[]), ...localOnlyItems]);
    });
  } catch (error) {
    console.error("Error hydrating list:", error);
  }
}

// Per-device "recently used" (Phase 6) — deliberately not synced to the
// server, see db.ts. Call whenever a list is actually opened/viewed.
export const recordListOpened = (listId: EntityId) =>
  db.recents.put({ listId, lastOpenedAt: new Date().toISOString() });

// Called by socket handlers (server push) to write straight into Dexie —
// the live query in the component picks it up automatically.
export const applyRemoteItem = (item: ListItemRow) => db.listItems.put(item);
export const removeRemoteItem = (itemId: EntityId) => db.listItems.delete(itemId);
export const applyRemoteList = (list: ListRow) => db.lists.put(list);
export const removeRemoteList = (listId: EntityId) => db.lists.delete(listId);

// ---------------------------------------------------------------------------
// Mutations: write optimistically to Dexie, queue for the server, try to
// drain immediately. Every mutation goes through the same queue whether
// online or offline — offline just means the drain has to wait.
// ---------------------------------------------------------------------------

type NewOutboxEntry = Omit<OutboxEntry, "status" | "retries" | "createdAt" | "id">;

async function enqueue(entry: NewOutboxEntry) {
  await db.outbox.add({ status: "pending", retries: 0, createdAt: new Date().toISOString(), ...entry });
  drainOutbox();
}

interface ListItemCreatePayload {
  item_id?: EntityId | null;
  name: string;
  quantity: number;
  unit?: string | null;
  notes?: string | null;
  category_id?: EntityId | null;
  area_id?: EntityId | null;
  priority?: string | null;
  brand?: string | null;
  favourite?: boolean;
  [key: string]: unknown;
}

export async function createListItem(listId: EntityId, payload: ListItemCreatePayload) {
  const tempId = makeTempId();
  const category = payload.category_id ? await db.categories.get(payload.category_id) : null;
  const area = payload.area_id ? await db.areas.get(payload.area_id) : null;
  await db.listItems.put({
    id: tempId,
    list_id: listId,
    ...payload,
    checked: false,
    checked_at: null,
    position: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: category ? { id: category.id as number, category_name: category.category_name } : null,
    area: area ? { id: area.id as number, area_name: area.area_name } : null,
  });
  await enqueue({ type: "createListItem", listId, payload, tempId });
  return tempId;
}

export async function updateListItem(listId: EntityId, itemId: EntityId, updates: Record<string, unknown>) {
  const previous = await db.listItems.get(itemId);
  if (!previous) return;
  const patch: Record<string, unknown> = { ...updates, updatedAt: new Date().toISOString() };
  if ("checked" in updates) patch.checked_at = updates.checked ? new Date().toISOString() : null;
  await db.listItems.update(itemId, patch);
  await enqueue({ type: "updateListItem", listId, itemId, payload: updates });
}

// Cancels any still-pending outbox entries referencing a temp id (as their
// own tempId, or as the target itemId/listId of a follow-up mutation)
// instead of sending the server a request about something it never knew
// existed — e.g. add an item offline, then delete it again before
// reconnecting: the create and delete should just cancel out locally.
async function cancelPendingFor(tempId: EntityId) {
  const pending = await db.outbox.where("status").equals("pending").toArray();
  for (const entry of pending) {
    if (entry.tempId === tempId || entry.itemId === tempId || entry.listId === tempId) {
      await db.outbox.delete(entry.id!);
    }
  }
}

export async function deleteListItem(listId: EntityId, itemId: EntityId) {
  await db.listItems.delete(itemId);
  if (isTempId(itemId)) {
    await cancelPendingFor(itemId);
    return;
  }
  await enqueue({ type: "deleteListItem", listId, itemId });
}

// Catalog entries (category/area/catalog item) can also be created from the
// add-item sheet — e.g. typing a brand-new item and area while offline at
// the store, exactly the scenario offline-first is for. Same optimistic
// write + queue pattern, just against the catalog tables.
export async function createCategory(name: string) {
  const tempId = makeTempId();
  await db.categories.put({
    id: tempId,
    category_name: name,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await enqueue({ type: "createCategory", payload: { category_name: name }, tempId });
  return tempId;
}

export async function createArea(name: string) {
  const tempId = makeTempId();
  await db.areas.put({
    id: tempId,
    area_name: name,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await enqueue({ type: "createArea", payload: { area_name: name }, tempId });
  return tempId;
}

// Updating/deleting a category or area is deliberately online-only, direct
// calls (like the Home mutations further down), not optimistic-queued like
// create above: a category still referenced by a catalog item comes back
// as a 409, and an optimistic local delete would have already made it
// vanish from the UI before that rejection is known — a mismatch that
// wouldn't reconcile until the next hydrateCatalog(). Confirming with the
// server first means the UI only ever shows what's actually true.
export async function updateCategory(categoryId: EntityId, updates: { category_name?: string; status?: string }) {
  if (!navigator.onLine) return homesOfflineError("Updating this category");
  const response = await authFetch(`/api/categories/${categoryId}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
  if (response.ok) await db.categories.update(categoryId, updates);
  return response;
}

export async function deleteCategory(categoryId: EntityId) {
  if (!navigator.onLine) return homesOfflineError("Deleting this category");
  const response = await authFetch(`/api/categories/${categoryId}`, { method: "DELETE" });
  if (response.ok) await db.categories.delete(categoryId);
  return response;
}

export async function updateArea(areaId: EntityId, updates: { area_name?: string; status?: string }) {
  if (!navigator.onLine) return homesOfflineError("Updating this area");
  const response = await authFetch(`/api/areas/${areaId}`, { method: "PUT", body: JSON.stringify(updates) });
  if (response.ok) await db.areas.update(areaId, updates);
  return response;
}

export async function deleteArea(areaId: EntityId) {
  if (!navigator.onLine) return homesOfflineError("Deleting this area");
  const response = await authFetch(`/api/areas/${areaId}`, { method: "DELETE" });
  if (response.ok) await db.areas.delete(areaId);
  return response;
}

export async function createCatalogItem(name: string, categoryId: EntityId) {
  const tempId = makeTempId();
  await db.catalogItems.put({
    id: tempId,
    item_name: name,
    category_id: categoryId,
    status: "active",
    purchase_count: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await enqueue({ type: "createCatalogItem", payload: { item_name: name, category_id: categoryId }, tempId });
  return tempId;
}

export async function createList(payload: { name: string; collaborators?: EntityId[] | null; home_id?: EntityId | null }) {
  const tempId = makeTempId();
  await db.lists.put({
    id: tempId,
    name: payload.name,
    collaborators: payload.collaborators || null,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await enqueue({ type: "createList", payload, tempId });
  return tempId;
}

export async function updateList(listId: EntityId, updates: Record<string, unknown>) {
  const patch: Record<string, unknown> = { ...updates, updatedAt: new Date().toISOString() };
  // Keep the nested `home` display object in sync with home_id locally too
  // (it's only ever populated from the server otherwise), so the UI doesn't
  // show a stale home name/chip until the next hydration reconciles it.
  if ("home_id" in updates) {
    patch.home = updates.home_id ? await db.homes.get(updates.home_id) : null;
  }
  await db.lists.update(listId, patch);
  await enqueue({ type: "updateList", listId, payload: updates });
}

// Unlike everything else in this file, duplication isn't queued — it needs
// to read a coherent, authoritative copy of the source list, which an
// offline-cached snapshot can't guarantee if it has its own unsynced
// changes. A rare, deliberate action, so requiring a connection for it is a
// reasonable trade rather than forcing the whole queue machinery onto it.
export async function duplicateList(listId: EntityId) {
  if (!navigator.onLine) {
    notify("failed", { message: "Duplicating a list needs an internet connection." });
    return null;
  }
  const response = await authFetch(`/api/lists/${listId}/duplicate`, { method: "POST" });
  if (!response.ok) {
    notify("failed", { message: "Couldn't duplicate that list — please try again." });
    return null;
  }
  const saved = await response.json();
  await db.lists.put(saved);
  await hydrateList(saved.id);
  return saved.id;
}

export async function deleteList(listId: EntityId) {
  await db.lists.delete(listId);
  await db.listItems.where("list_id").equals(listId).delete();
  if (isTempId(listId)) {
    await cancelPendingFor(listId);
    return;
  }
  await enqueue({ type: "deleteList", listId });
}

// Removing a specific collaborator (the "Exit List" action on a user's
// detail page) is a cross-user membership change like the home mutations
// below — online-only, direct call, refresh the local cache from the
// response, rather than an optimistic outbox-queued write.
export async function removeListCollaborator(
  listId: EntityId,
  userId: EntityId,
  currentCollaborators: EntityId[]
) {
  if (!navigator.onLine) {
    notify("failed", { message: "Removing this list needs an internet connection." });
    return false;
  }
  const collaborators = currentCollaborators.filter((id) => String(id) !== String(userId));
  const response = await authFetch(`/api/lists/${listId}`, {
    method: "PUT",
    body: JSON.stringify({ collaborators }),
  });
  if (response.ok) await db.lists.update(listId, { collaborators });
  return response.ok;
}

// ---------------------------------------------------------------------------
// Homes (households): online-only, same rationale as duplicateList above —
// membership changes have cross-user consequences ("am I still in this
// household?") that don't reconcile well as an optimistic local write with
// eventual "last write wins" sync, and aren't something anyone plausibly
// needs to do mid-shopping-trip-offline. Unlike list/item mutations, these
// just call the API directly and refresh the local cache from the response.
// ---------------------------------------------------------------------------

const homesOfflineError = (action: string) => {
  notify("failed", { message: `${action} needs an internet connection.` });
  return null;
};

// Shared by any component reading an error detail out of a non-ok Response
// from one of this file's online-only calls (e.g. updateCategory/
// deleteCategory below) — mirrors the axios.isAxiosError(...).response?.data
// ?.detail pattern used elsewhere, just for the raw-fetch Response shape.
export async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return typeof body?.detail === "string" ? body.detail : fallback;
  } catch {
    return fallback;
  }
}

export async function fetchHomes() {
  if (!navigator.onLine) return;
  try {
    const response = await authFetch("/api/homes");
    if (!response.ok) return;
    const homes: HomeRow[] = await response.json();
    await db.homes.bulkPut(homes);
  } catch (error) {
    console.error("Error fetching homes:", error);
  }
}

export async function createHome(name: string, ownerUserId: EntityId) {
  if (!navigator.onLine) return homesOfflineError("Creating a home");
  const response = await authFetch("/api/homes", {
    method: "POST",
    body: JSON.stringify({ name, owner_user_id: ownerUserId }),
  });
  if (!response.ok) {
    notify("failed", { message: "Couldn't create that home — please try again." });
    return null;
  }
  const saved = await response.json();
  await db.homes.put(saved);
  return saved.id;
}

export async function renameHome(homeId: EntityId, name: string) {
  if (!navigator.onLine) return homesOfflineError("Renaming a home");
  const response = await authFetch(`/api/homes/${homeId}`, { method: "PUT", body: JSON.stringify({ name }) });
  if (response.ok) await db.homes.update(homeId, { name });
  return response.ok;
}

export async function deleteHome(homeId: EntityId) {
  if (!navigator.onLine) return homesOfflineError("Deleting a home");
  const response = await authFetch(`/api/homes/${homeId}`, { method: "DELETE" });
  if (response.ok) {
    await db.homes.delete(homeId);
    // Any locally-cached lists that pointed at this home lose that
    // association too, matching what the server just did.
    await db.lists.where("home_id").equals(homeId).modify({ home_id: null, home: null });
  }
  return response.ok;
}

export async function addHomeMember(homeId: EntityId, userId: EntityId, role = "member") {
  if (!navigator.onLine) return homesOfflineError("Adding a member");
  const response = await authFetch(`/api/homes/${homeId}/members`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, role }),
  });
  if (response.ok) await db.homes.put(await response.json());
  return response;
}

export async function updateHomeMemberRole(homeId: EntityId, userId: EntityId, role: string) {
  if (!navigator.onLine) return homesOfflineError("Changing a member's role");
  return authFetch(`/api/homes/${homeId}/members/${userId}`, { method: "PUT", body: JSON.stringify({ role }) });
}

export async function transferHomeOwnership(homeId: EntityId, userId: EntityId) {
  if (!navigator.onLine) return homesOfflineError("Transferring ownership");
  return authFetch(`/api/homes/${homeId}/owner`, { method: "PUT", body: JSON.stringify({ user_id: userId }) });
}

export async function removeHomeMember(homeId: EntityId, userId: EntityId) {
  if (!navigator.onLine) return homesOfflineError("Removing a member");
  const response = await authFetch(`/api/homes/${homeId}/members/${userId}`, { method: "DELETE" });
  return response;
}

export async function leaveHome(homeId: EntityId) {
  const cachedUser = getCachedCurrentUser();
  if (!cachedUser) return null;
  const response = await removeHomeMember(homeId, cachedUser.id);
  if (response?.ok) await db.homes.delete(homeId);
  return response;
}

// ---------------------------------------------------------------------------
// Draining: replay queued mutations against the server in the order they
// happened. Stops (rather than skips) on network failure so ordering is
// preserved for next time; drops + notifies on a confirmed conflict (the
// target no longer exists); gives up after repeated hard failures so one
// broken entry can't wedge the whole queue forever.
// ---------------------------------------------------------------------------

let draining = false;
const MAX_RETRIES = 5;

// When a temp-id create syncs and gets a real id, any later queued entries
// that still reference the temp id (e.g. "check this item" queued right
// after "add this item", both while offline) need to be repointed before
// they're sent.
async function remapTempId(tempId: EntityId, realId: EntityId) {
  const pending = await db.outbox.where("status").equals("pending").toArray();
  for (const entry of pending) {
    let changed = false;
    if (entry.itemId === tempId) {
      entry.itemId = realId;
      changed = true;
    }
    if (entry.listId === tempId) {
      entry.listId = realId;
      changed = true;
    }
    if (entry.payload) {
      for (const field of ["item_id", "category_id", "area_id", "list_id"]) {
        if (entry.payload[field] === tempId) {
          entry.payload[field] = realId;
          changed = true;
        }
      }
    }
    if (changed) await db.outbox.put(entry);
  }
}

class SyncNetworkError extends Error {
  name = "SyncNetworkError";
}

class SyncConflictError extends Error {
  name = "SyncConflictError";
}

export async function drainOutbox() {
  if (draining || !navigator.onLine) return;
  draining = true;
  try {
    for (;;) {
      const entry = await db.outbox.where("status").equals("pending").sortBy("createdAt").then((rows) => rows[0]);
      if (!entry) break;

      try {
        await processEntry(entry);
        await db.outbox.delete(entry.id!);
      } catch (error) {
        if (error instanceof SyncNetworkError) {
          break; // offline mid-drain — stop, preserve order, retry later
        }
        if (error instanceof SyncConflictError) {
          await db.outbox.delete(entry.id!);
          notify("conflict", { entry, message: error.message });
          continue;
        }
        const retries = (entry.retries || 0) + 1;
        if (retries >= MAX_RETRIES) {
          await db.outbox.delete(entry.id!);
          notify("failed", { entry, message: "Gave up syncing a change after repeated failures." });
        } else {
          await db.outbox.update(entry.id!, { retries, status: "pending" });
          break; // back off — don't hammer a failing entry in a tight loop
        }
      }
    }
  } finally {
    draining = false;
  }
}

async function processEntry(entry: OutboxEntry) {
  let response: Response;
  try {
    response = await requestFor(entry);
  } catch {
    throw new SyncNetworkError("Network error");
  }

  if (response.status === 404) {
    throw new SyncConflictError(`"${(entry.payload?.name as string) || "An item"}" was removed elsewhere.`);
  }
  if (response.status === 403) {
    // Access to the list was removed while this was queued offline — e.g.
    // uninvited as a collaborator, or (new with Homes) the list was queued
    // with a home_id the user then lost membership in before reconnecting.
    // Not something retrying will ever fix.
    throw new SyncConflictError(
      `"${(entry.payload?.name as string) || "A change"}" couldn't be synced — access was removed.`
    );
  }
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  const tables = { createCategory: db.categories, createArea: db.areas, createCatalogItem: db.catalogItems } as const;

  if (entry.type === "createListItem") {
    const saved = await response.json();
    await db.listItems.delete(entry.tempId!);
    await db.listItems.put(saved);
    await remapTempId(entry.tempId!, saved.id);
  } else if (entry.type === "updateListItem") {
    const saved = await response.json();
    await db.listItems.put(saved);
  } else if (entry.type === "createList") {
    const saved = await response.json();
    await db.lists.delete(entry.tempId!);
    await db.lists.put(saved);
    // Any items added to this list before its own create synced are still
    // filed under the temp id locally — move them over so the live query
    // (keyed on the real id) finds them.
    await db.listItems.where("list_id").equals(entry.tempId!).modify({ list_id: saved.id });
    await remapTempId(entry.tempId!, saved.id);
  } else if (entry.type in tables) {
    const saved = await response.json();
    const table = tables[entry.type as keyof typeof tables];
    await table.delete(entry.tempId!);
    await (table as (typeof tables)["createCategory"]).put(saved);
    await remapTempId(entry.tempId!, saved.id);
  }
  // deleteListItem / deleteList / updateList: Dexie already reflects the
  // change from the optimistic write, nothing further to reconcile.
}

function requestFor(entry: OutboxEntry) {
  switch (entry.type) {
    case "createListItem":
      return authFetch(`/api/lists/list/${entry.listId}/items`, {
        method: "POST",
        body: JSON.stringify(entry.payload),
      });
    case "updateListItem":
      return authFetch(`/api/lists/list/${entry.listId}/items/${entry.itemId}`, {
        method: "PUT",
        body: JSON.stringify(entry.payload),
      });
    case "deleteListItem":
      return authFetch(`/api/lists/list/${entry.listId}/items/${entry.itemId}`, { method: "DELETE" });
    case "createList":
      return authFetch(`/api/lists`, { method: "POST", body: JSON.stringify(entry.payload) });
    case "updateList":
      return authFetch(`/api/lists/${entry.listId}`, { method: "PUT", body: JSON.stringify(entry.payload) });
    case "deleteList":
      return authFetch(`/api/lists/${entry.listId}`, { method: "DELETE" });
    case "createCategory":
      return authFetch(`/api/categories`, { method: "POST", body: JSON.stringify(entry.payload) });
    case "createArea":
      return authFetch(`/api/areas`, { method: "POST", body: JSON.stringify(entry.payload) });
    case "createCatalogItem":
      return authFetch(`/api/items`, { method: "POST", body: JSON.stringify(entry.payload) });
    default:
      return Promise.reject(new Error(`Unknown outbox entry type: ${entry.type}`));
  }
}

// ---------------------------------------------------------------------------
// Wiring: call once at app startup.
// ---------------------------------------------------------------------------

export function startAutoSync() {
  window.addEventListener("online", () => drainOutbox());
  // Fallback for browsers/tabs where the online event or Background Sync
  // isn't reliable — cheap no-op when there's nothing queued.
  setInterval(() => drainOutbox(), 30000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
      if (event.data?.type === "SYNC_OUTBOX") drainOutbox();
    });
    navigator.serviceWorker.ready.then((registration) => {
      // Background Sync isn't in lib.dom's ServiceWorkerRegistration type
      // (experimental API, not universally supported) — feature-detected
      // at runtime same as the original JS did, just typed as a narrow
      // local interface instead of reaching for `any`.
      const syncRegistration = registration as ServiceWorkerRegistration & {
        sync?: { register(tag: string): Promise<void> };
      };
      if (syncRegistration.sync) {
        syncRegistration.sync.register("sync-outbox").catch(() => {});
      }
    });
  }

  if (navigator.onLine) drainOutbox();
}
