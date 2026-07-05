import axios from "axios";
import { API_BASE_URL, apiClient } from "./client";
import { tokenStorage } from "./tokenStorage";
import type { TokenResponse, UserOut } from "./types";

// Login intentionally uses plain axios, not apiClient: there's no access
// token yet at login time, and the interceptor's refresh-on-401 logic
// doesn't apply here anyway (client.ts already special-cases this URL).
export async function login(username: string, password: string): Promise<void> {
  const response = await axios.post<TokenResponse>(`${API_BASE_URL}/api/auth/login`, { username, password });
  tokenStorage.setTokens(response.data.access_token, response.data.refresh_token);
}

export async function logout(): Promise<void> {
  const refreshToken = tokenStorage.getRefreshToken();
  tokenStorage.clear();
  if (refreshToken) {
    await axios.post(`${API_BASE_URL}/api/auth/logout`, { refresh_token: refreshToken }).catch(() => {
      // Best-effort — tokens are already cleared client-side either way.
    });
  }
}

export async function fetchCurrentUser(): Promise<UserOut> {
  const response = await apiClient.get<UserOut>("/api/auth/me");
  return response.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.put("/api/auth/change-password", { current_password: currentPassword, new_password: newPassword });
}

export function isAuthenticated(): boolean {
  return Boolean(tokenStorage.getAccessToken());
}
