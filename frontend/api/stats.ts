import { apiClient } from "./client";
import type { StatsOut } from "./types";

export async function getStats(): Promise<StatsOut> {
  const response = await apiClient.get<StatsOut>("/api/stats");
  return response.data;
}
