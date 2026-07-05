import { apiClient } from "./client";
import type { UserOut } from "./types";

export async function getCollaborators(): Promise<UserOut[]> {
  const response = await apiClient.get<UserOut[]>("/api/lists/collaborators");
  return response.data;
}
