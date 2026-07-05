import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "../db";
import { normalizeId } from "../components/List";
import { listUsers } from "../api/users";
import type { Crumb } from "./Breadcrumbs";

// Reads the live list name straight from Dexie so the breadcrumb updates
// instantly if the list is renamed, without a extra network round-trip.
const ListCrumbLabel = ({ listId }: { listId: string }) => {
  const list = useLiveQuery(() => db.lists.get(normalizeId(listId)), [listId]);
  return list?.name || "…";
};

const HomeCrumbLabel = ({ homeId }: { homeId: string }) => {
  const home = useLiveQuery(() => db.homes.get(normalizeId(homeId)), [homeId]);
  return home?.name || "…";
};

// Users have no offline Dexie cache (unlike lists/homes), so this fetches
// once via the API rather than a live query.
const UserCrumbLabel = ({ userId }: { userId: string }) => {
  const [name, setName] = useState("…");
  useEffect(() => {
    let cancelled = false;
    listUsers()
      .then((users) => {
        if (cancelled) return;
        const user = users.find((u) => String(u.id) === userId);
        if (user) setName(`${user.firstname} ${user.lastname}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return name;
};

export const listsCrumbs = (): Crumb[] => [{ label: "Lists" }];
export const listDetailCrumbs = (params: Record<string, string | undefined>): Crumb[] => [
  { label: "Lists", to: "/lists" },
  { label: <ListCrumbLabel listId={params.listId!} /> },
];
export const homesCrumbs = (): Crumb[] => [{ label: "Homes" }];
export const homeDetailCrumbs = (params: Record<string, string | undefined>): Crumb[] => [
  { label: "Homes", to: "/homes" },
  { label: <HomeCrumbLabel homeId={params.homeId!} /> },
];
export const usersCrumbs = (): Crumb[] => [{ label: "Users" }];
export const userDetailCrumbs = (params: Record<string, string | undefined>): Crumb[] => [
  { label: "Users", to: "/users" },
  { label: <UserCrumbLabel userId={params.userId!} /> },
];
export const statsCrumbs = (): Crumb[] => [{ label: "Stats" }];
export const settingsCrumbs = (): Crumb[] => [{ label: "Settings" }];
