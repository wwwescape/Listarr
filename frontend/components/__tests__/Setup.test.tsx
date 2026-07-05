import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { test, expect, vi } from "vitest";
import Setup from "../Setup";

// Setup checks localStorage first and falls back to asking the server
// whether an admin already exists. Mocked explicitly rather than relying on
// the request simply having nothing to talk to under jsdom — a real backend
// happening to run on the same machine (e.g. a dev server left up from
// manual testing) would otherwise answer "admin_exists: true" and make this
// test flake by redirecting straight to /login instead of rendering the form.
vi.mock("../../api/users", () => ({
  checkAdminExists: () => Promise.resolve(false),
}));

test("shows the create-admin-user screen on a fresh install", async () => {
  localStorage.clear();
  // Testing Setup directly (rather than the full App -> Bootstrap -> redirect
  // -> Setup chain) keeps this a unit test of "what does /setup show on a
  // fresh install" without depending on react-router's real browser
  // navigation, which doesn't play well with jsdom's fetch/AbortSignal
  // handling across an actual route change mid-test.
  render(
    <MemoryRouter initialEntries={["/setup"]}>
      <Setup />
    </MemoryRouter>
  );
  const heading = await screen.findByText(/create admin user/i);
  expect(heading).toBeInTheDocument();
});
