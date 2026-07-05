import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { tokenStorage } from "./tokenStorage";
import type { TokenResponse } from "./types";

// Dev: Vite serves the frontend on :3000 (or whatever port it falls back to if that one's
// taken — import.meta.env.DEV doesn't care which), FastAPI runs separately on :8000. Prod:
// FastAPI serves the built frontend itself, so they're the same origin.
export const API_BASE_URL = import.meta.env.DEV ? "http://localhost:8000" : window.location.origin;

export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface PendingRequest {
  config: RetryableConfig;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

let isRefreshing = false;
let pendingRequests: PendingRequest[] = [];

function redirectToLogin(): void {
  tokenStorage.clear();
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    // A 401 from login/refresh themselves means bad credentials or an
    // already-dead refresh token — attempting another refresh would just
    // loop. (Every other /api/auth/* route, e.g. /me, is a normal protected
    // endpoint and should still go through the refresh-and-retry path
    // below.)
    if (originalRequest.url === "/api/auth/login" || originalRequest.url === "/api/auth/refresh") {
      return Promise.reject(error);
    }

    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      redirectToLogin();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push({ config: originalRequest, resolve, reject });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await axios.post<TokenResponse>(`${API_BASE_URL}/api/auth/refresh`, {
        refresh_token: refreshToken,
      });
      const { access_token: accessToken, refresh_token: newRefreshToken } = response.data;
      tokenStorage.setTokens(accessToken, newRefreshToken);

      pendingRequests.forEach(({ config, resolve, reject }) => {
        config.headers.set("Authorization", `Bearer ${accessToken}`);
        apiClient.request(config).then(resolve).catch(reject);
      });
      pendingRequests = [];

      originalRequest.headers.set("Authorization", `Bearer ${accessToken}`);
      return apiClient.request(originalRequest);
    } catch (refreshError) {
      pendingRequests.forEach(({ reject }) => reject(refreshError));
      pendingRequests = [];
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
