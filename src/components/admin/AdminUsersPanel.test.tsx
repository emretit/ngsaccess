import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ExpiredInvites } from "./AdminUsersPanel";

const state = vi.hoisted(() => ({
  type: "reset" as "reset" | "invite",
  send: vi.fn(async (_args: unknown) => ({ success: true })),
  click: undefined as (() => void) | undefined,
}));
vi.mock("convex/react", () => ({ useQuery: () => [{ _id: "invite", email: "person@example.test", projectId: "project", role: "viewer", type: state.type, expiresAt: "2026-01-01" }], useAction: () => state.send }));
vi.mock("@/components/ui/button", () => ({ Button: ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => { state.click = onClick; return <button>{children}</button>; } }));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() }, errorMessage: (error: unknown) => String(error) }));
beforeEach(() => { state.send.mockClear(); state.click = undefined; });

it.each(["reset", "invite"] as const)("HSP-04 resends expired %s with its original purpose", async type => {
  state.type = type;
  const html = renderToStaticMarkup(<ExpiredInvites projects={[]} />);
  expect(state.click).toBeDefined();
  state.click?.();
  await vi.waitFor(() => expect(state.send).toHaveBeenCalledWith({ email: "person@example.test", projectId: "project", role: "viewer", type }));
  expect(html).toContain(type === "reset" ? "Şifre sıfırlama" : "Proje daveti");
});
