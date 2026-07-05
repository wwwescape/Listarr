import axios, { type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, apiClient } from "../client";
import { tokenStorage } from "../tokenStorage";

// axios's InterceptorManager keeps registered interceptors in a `handlers`
// array (not part of its public types, but stable across versions) — that's
// the only way to invoke client.ts's response interceptor directly without
// standing up a real HTTP server.
function getResponseErrorHandler() {
  const handlers = (apiClient.interceptors.response as unknown as { handlers: Array<{ rejected: (error: unknown) => unknown }> })
    .handlers;
  return handlers[0].rejected;
}

function fakeConfig(url: string): InternalAxiosRequestConfig {
  return { url, headers: { set: vi.fn() } } as unknown as InternalAxiosRequestConfig;
}

// jsdom's window.location.assign isn't a configurable property, so vi.spyOn
// can't wrap it directly — replace the whole location object for the
// duration of a test instead.
function stubLocationAssign() {
  const original = window.location;
  const assign = vi.fn();
  Object.defineProperty(window, "location", {
    value: { ...original, assign },
    writable: true,
    configurable: true,
  });
  return {
    assign,
    restore: () => Object.defineProperty(window, "location", { value: original, writable: true, configurable: true }),
  };
}

describe("apiClient response interceptor", () => {
  afterEach(() => {
    tokenStorage.clear();
    vi.restoreAllMocks();
  });

  it("passes non-401 errors through unchanged", async () => {
    const rejected = getResponseErrorHandler();
    const error = { response: { status: 500 }, config: fakeConfig("/api/lists") };

    await expect(rejected(error)).rejects.toBe(error);
  });

  it("does not attempt a refresh for the login/refresh endpoints themselves", async () => {
    const postSpy = vi.spyOn(axios, "post");
    const rejected = getResponseErrorHandler();
    const error = { response: { status: 401 }, config: fakeConfig("/api/auth/login") };

    await expect(rejected(error)).rejects.toBe(error);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("redirects to /login when a 401 occurs with no refresh token stored", async () => {
    const location = stubLocationAssign();
    try {
      const rejected = getResponseErrorHandler();
      const error = { response: { status: 401 }, config: fakeConfig("/api/lists") };

      await expect(rejected(error)).rejects.toBe(error);
      expect(location.assign).toHaveBeenCalledWith("/login");
    } finally {
      location.restore();
    }
  });

  it("refreshes the access token and retries the original request on a 401", async () => {
    tokenStorage.setTokens("old-access", "old-refresh");
    vi.spyOn(axios, "post").mockResolvedValue({
      data: { access_token: "new-access", refresh_token: "new-refresh" },
    });
    const requestSpy = vi.spyOn(apiClient, "request").mockResolvedValue({ data: "ok" });

    const rejected = getResponseErrorHandler();
    const config = fakeConfig("/api/lists");
    const error = { response: { status: 401 }, config };

    const result = await rejected(error);

    expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/api/auth/refresh`, { refresh_token: "old-refresh" });
    expect(tokenStorage.getAccessToken()).toBe("new-access");
    expect(tokenStorage.getRefreshToken()).toBe("new-refresh");
    expect(requestSpy).toHaveBeenCalledWith(config);
    expect(result).toEqual({ data: "ok" });
  });

  it("clears tokens and redirects when the refresh call itself fails", async () => {
    tokenStorage.setTokens("old-access", "old-refresh");
    vi.spyOn(axios, "post").mockRejectedValue(new Error("refresh token expired"));
    const location = stubLocationAssign();

    try {
      const rejected = getResponseErrorHandler();
      const error = { response: { status: 401 }, config: fakeConfig("/api/lists") };

      await expect(rejected(error)).rejects.toThrow("refresh token expired");
      expect(tokenStorage.getAccessToken()).toBeNull();
      expect(location.assign).toHaveBeenCalledWith("/login");
    } finally {
      location.restore();
    }
  });
});
