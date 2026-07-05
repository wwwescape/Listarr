import { afterEach, describe, expect, it } from "vitest";
import { tokenStorage } from "../tokenStorage";

describe("tokenStorage", () => {
  afterEach(() => {
    tokenStorage.clear();
  });

  it("returns null for both tokens when nothing has been stored", () => {
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it("stores and retrieves both tokens", () => {
    tokenStorage.setTokens("access-1", "refresh-1");
    expect(tokenStorage.getAccessToken()).toBe("access-1");
    expect(tokenStorage.getRefreshToken()).toBe("refresh-1");
  });

  it("overwrites previously stored tokens", () => {
    tokenStorage.setTokens("access-1", "refresh-1");
    tokenStorage.setTokens("access-2", "refresh-2");
    expect(tokenStorage.getAccessToken()).toBe("access-2");
    expect(tokenStorage.getRefreshToken()).toBe("refresh-2");
  });

  it("clears both tokens", () => {
    tokenStorage.setTokens("access-1", "refresh-1");
    tokenStorage.clear();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });
});
