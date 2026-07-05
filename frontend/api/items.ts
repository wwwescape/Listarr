import { apiClient } from "./client";
import type { SuggestionsOut } from "./types";

export async function getSuggestions(): Promise<SuggestionsOut> {
  const response = await apiClient.get<SuggestionsOut>("/api/items/suggestions");
  return response.data;
}
