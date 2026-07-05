import { apiClient } from "./client";
import type { HomeDetailOut } from "./types";

export async function getHome(homeId: number): Promise<HomeDetailOut> {
  const response = await apiClient.get<HomeDetailOut>(`/api/homes/${homeId}`);
  return response.data;
}
