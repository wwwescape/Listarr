import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { tokenStorage } from "../../api/tokenStorage";
import ProtectedLayout from "../ProtectedLayout";

describe("ProtectedLayout", () => {
  afterEach(() => {
    tokenStorage.clear();
  });

  it("redirects to /login when there is no access token", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<div>Protected content</div>} />
          </Route>
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("renders the protected route when an access token is present", () => {
    tokenStorage.setTokens("access-token", "refresh-token");

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<div>Protected content</div>} />
          </Route>
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
