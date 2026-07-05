import { apiClient } from "./client";
import type { HomeMembershipOut, ListOut, UserCreate, UserOut, UserUpdate } from "./types";

// Unauthenticated on purpose — Setup.tsx/Bootstrap.tsx call this before any
// login exists, to tell "fresh install" from "an admin already exists, go
// log in". Deliberately not listUsers(): that route now requires auth, and
// a 401 pre-login would otherwise trip apiClient's redirect-to-/login
// interceptor.
export async function checkAdminExists(): Promise<boolean> {
  const response = await apiClient.get<{ admin_exists: boolean }>("/api/users/exists");
  return response.data.admin_exists;
}

export async function listUsers(): Promise<UserOut[]> {
  const response = await apiClient.get<UserOut[]>("/api/users");
  return response.data;
}

export async function createUser(payload: UserCreate): Promise<UserOut> {
  const response = await apiClient.post<UserOut>("/api/users", payload);
  return response.data;
}

export async function updateUser(userId: number, payload: UserUpdate): Promise<void> {
  await apiClient.put(`/api/users/${userId}`, payload);
}

export async function deleteUser(userId: number): Promise<void> {
  await apiClient.delete(`/api/users/${userId}`);
}

// Homes/lists a specific user belongs to — for the User detail page's tabs.
// Backend restricts these to that user themselves or an admin.
export async function getUserHomes(userId: number): Promise<HomeMembershipOut[]> {
  const response = await apiClient.get<HomeMembershipOut[]>(`/api/users/${userId}/homes`);
  return response.data;
}

export async function getUserLists(userId: number): Promise<ListOut[]> {
  const response = await apiClient.get<ListOut[]>(`/api/users/${userId}/lists`);
  return response.data;
}
