export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserOut {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  admin?: boolean | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UserCreate {
  username: string;
  password: string;
  firstname: string;
  lastname: string;
}

export interface UserUpdate {
  username?: string;
  firstname?: string;
  lastname?: string;
  password?: string;
}

export interface HomeOut {
  id: number;
  name: string;
  created_by?: number | null;
  member_count: number;
  my_role?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface HomeMemberOut {
  id: number;
  home_id: number;
  user: UserOut;
  role: string;
  createdAt?: string | null;
}

export interface HomeDetailOut extends HomeOut {
  members: HomeMemberOut[];
}

// A specific user's membership in one home (that user's role there) — the
// shape GET /api/users/:id/homes returns, distinct from HomeOut's `my_role`
// (the requester's own role).
export interface HomeMembershipOut {
  id: number;
  name: string;
  role: string;
  member_count: number;
}

export interface HomeSummaryOut {
  id: number;
  name: string;
}

export interface ListOut {
  id: number;
  name: string;
  createdBy: string;
  collaborators?: (number | string)[] | null;
  status?: string | null;
  favourite: boolean;
  home_id?: number | null;
  home?: HomeSummaryOut | null;
  created_at?: string | null;
  updated_at?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CategoryOut {
  id: number;
  category_name: string;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AreaOut {
  id: number;
  area_name: string;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ListItemOut {
  id: number;
  list_id: number;
  item_id?: number | null;
  name: string;
  quantity: number;
  unit?: string | null;
  notes?: string | null;
  category_id?: number | null;
  area_id?: number | null;
  priority?: string | null;
  brand?: string | null;
  favourite: boolean;
  checked: boolean;
  checked_at?: string | null;
  position?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  category?: CategoryOut | null;
  area?: AreaOut | null;
}

export interface SuggestionsOut {
  favourites: ListItemOut[];
  recent: ListItemOut[];
  frequent: ListItemOut[];
}

export interface CountEntry {
  label: string;
  count: number;
}

export interface StatsOut {
  total_lists: number;
  total_items: number;
  completed_items: number;
  completion_rate: number;
  most_purchased: CountEntry[];
  category_breakdown: CountEntry[];
  activity_by_week: CountEntry[];
}
