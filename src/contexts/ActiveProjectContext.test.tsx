import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ActiveProjectProvider } from "./ActiveProjectContext";
const state = vi.hoisted(() => ({
  profile: null as { role: string; verified?: boolean } | null,
  authenticated: true,
  query: vi.fn(),
}));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ profile: state.profile, loading: false }) }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: state.authenticated }),
  useQuery: (...args: unknown[]) => { state.query(...args); return []; },
}));
beforeEach(() => { state.query.mockClear(); state.authenticated = true; });
it.each([null, { role: "project_user", verified: false }])("skips memberships while profile is absent or unverified (%j)", profile => {
  state.profile = profile;
  renderToStaticMarkup(<ActiveProjectProvider><span /></ActiveProjectProvider>);
  expect(state.query.mock.calls[0][1]).toBe("skip");
});
it.each([true, undefined])("loads memberships for verified and legacy users (%s)", verified => {
  state.profile = { role: "project_user", verified };
  renderToStaticMarkup(<ActiveProjectProvider><span /></ActiveProjectProvider>);
  expect(state.query.mock.calls[0][1]).toEqual({});
});
it("skips memberships after logout", () => {
  state.authenticated = false;
  state.profile = { role: "project_user", verified: true };
  renderToStaticMarkup(<ActiveProjectProvider><span /></ActiveProjectProvider>);
  expect(state.query.mock.calls[0][1]).toBe("skip");
});
