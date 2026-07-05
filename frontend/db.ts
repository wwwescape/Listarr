import Dexie, { type Table } from "dexie";

// Real ids come back from the server as numbers; a not-yet-synced row
// created offline carries a string "temp-..." id until the outbox drains
// and replaces it with the real one (see sync.ts's makeTempId/isTempId).
export type EntityId = number | string;

export interface CategoryRow {
  id: EntityId;
  category_name: string;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AreaRow {
  id: EntityId;
  area_name: string;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CatalogItemRow {
  id: EntityId;
  item_name: string;
  category_id?: EntityId | null;
  status?: string | null;
  purchase_count?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface HomeRow {
  id: EntityId;
  name: string;
  created_by?: number | null;
  member_count?: number;
  my_role?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ListRow {
  id: EntityId;
  name: string;
  createdBy?: string;
  collaborators?: EntityId[] | null;
  status?: string | null;
  favourite?: boolean;
  home_id?: EntityId | null;
  home?: { id: number; name: string } | null;
  created_at?: string | null;
  updated_at?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ListItemRow {
  id: EntityId;
  list_id: EntityId;
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
  checked?: boolean;
  checked_at?: string | null;
  position?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  category?: { id: number; category_name: string } | null;
  area?: { id: number; area_name: string } | null;
}

export interface RecentRow {
  listId: EntityId;
  lastOpenedAt: string;
}

export interface MetaRow {
  key: string;
  value?: unknown;
}

export type OutboxEntryType =
  | "createListItem"
  | "updateListItem"
  | "deleteListItem"
  | "createList"
  | "updateList"
  | "deleteList"
  | "createCategory"
  | "createArea"
  | "createCatalogItem";

export interface OutboxEntry {
  id?: number; // auto-incremented by Dexie ("++id") — absent until inserted
  type: OutboxEntryType;
  status: "pending";
  retries: number;
  createdAt: string;
  tempId?: EntityId;
  listId?: EntityId;
  itemId?: EntityId;
  // Shape varies by `type` (mirrors whatever the matching REST endpoint's
  // request body needs) — kept loose since remapTempId/processEntry in
  // sync.ts intentionally poke at it generically across every entry type.
  payload?: Record<string, unknown>;
}

// IndexedDB is the client's source of truth: the UI reads from here (via
// live queries, so it updates automatically whether the change came from a
// local optimistic write, a socket event, or a server hydration), not
// directly from fetch responses. `outbox` is the offline mutation queue —
// see sync.ts for how rows move through pending -> syncing -> gone.
class ShoppingListsDB extends Dexie {
  // `declare` (not `!`), since tsconfig's useDefineForClassFields:true would
  // otherwise emit a real field initializer that runs after super() and
  // shadows the property Dexie itself assigns from `.stores()` below — a
  // well-documented Dexie+TS gotcha. `declare` is type-only, no runtime code.
  declare lists: Table<ListRow, EntityId>;
  declare listItems: Table<ListItemRow, EntityId>;
  declare categories: Table<CategoryRow, EntityId>;
  declare areas: Table<AreaRow, EntityId>;
  declare catalogItems: Table<CatalogItemRow, EntityId>;
  declare outbox: Table<OutboxEntry, number>;
  declare meta: Table<MetaRow, string>;
  // v2 (Phase 6): per-device "recently used" tracking — deliberately local
  // only, not synced to the server. Recency is a personal, current-device
  // notion here rather than shared collaborative state.
  declare recents: Table<RecentRow, EntityId>;
  // v3: Homes (households) — cached for offline display, but membership
  // mutations themselves are online-only (see sync.ts). `lists` gains a
  // home_id index for Home-scoped lookups; the nested `home: {id, name}`
  // field on each list record comes along for free once the server
  // includes it, no extra hydration work needed for that part.
  declare homes: Table<HomeRow, EntityId>;

  constructor() {
    super("shopping-lists");

    this.version(1).stores({
      lists: "id",
      listItems: "id, list_id",
      categories: "id",
      areas: "id",
      catalogItems: "id",
      outbox: "++id, listId, status, createdAt",
      meta: "key",
    });

    this.version(2).stores({
      recents: "listId, lastOpenedAt",
    });

    this.version(3).stores({
      homes: "id",
      lists: "id, home_id",
    });
  }
}

export const db = new ShoppingListsDB();

export default db;
