import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const authMocks = vi.hoisted(() => ({
  getValidAuthUserId: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("./lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/auth")>();
  return { ...actual, ...authMocks };
});

import { listActive } from "./projects";
import { listSyncIssues as listIdeSyncIssues } from "./ideSync";
import { listSyncIssues as listHikvisionSyncIssues } from "./hikvisionSync";

const userId = "user-1" as Id<"users">;

function queryContext(projects: Array<{ _id: Id<"projects">; isActive?: boolean }> = []) {
  const collect = vi.fn(async () => projects);
  const ctx = {
    db: {
      query: vi.fn(() => ({ collect })),
    },
  } as unknown as QueryCtx;
  return { ctx, collect };
}

function runQueryHandler<TArgs extends object>(registered: unknown, ctx: QueryCtx, args: TArgs) {
  const query = registered as { _handler: (ctx: QueryCtx, args: TArgs) => Promise<unknown> };
  return query._handler(ctx, args);
}

describe("sync issue query auth", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns empty values without a valid session", async () => {
    authMocks.getValidAuthUserId.mockResolvedValue(null);
    const { ctx } = queryContext();

    await expect(runQueryHandler(listActive, ctx, {})).resolves.toEqual([]);
    await expect(runQueryHandler(listIdeSyncIssues, ctx, {})).resolves.toEqual({
      items: [], hasMore: false, unknown: false,
    });
    await expect(runQueryHandler(listHikvisionSyncIssues, ctx, {})).resolves.toEqual({
      items: [], hasMore: false, unknown: false,
    });
    expect(authMocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it("returns empty values when the JWT session has been deleted", async () => {
    // getValidAuthUserId returns null for the deleted-session case (covered in auth.test.ts).
    authMocks.getValidAuthUserId.mockResolvedValue(null);
    const { ctx } = queryContext();

    await expect(runQueryHandler(listActive, ctx, {})).resolves.toEqual([]);
    await expect(runQueryHandler(listIdeSyncIssues, ctx, {})).resolves.toEqual({
      items: [], hasMore: false, unknown: false,
    });
    await expect(runQueryHandler(listHikvisionSyncIssues, ctx, {})).resolves.toEqual({
      items: [], hasMore: false, unknown: false,
    });
  });

  it("preserves active project results for a verified super admin", async () => {
    authMocks.getValidAuthUserId.mockResolvedValue(userId);
    authMocks.getCurrentUser.mockResolvedValue({ _id: userId, role: "super_admin" });
    const activeId = "project-active" as Id<"projects">;
    const { ctx, collect } = queryContext([
      { _id: activeId, isActive: true },
      { _id: "project-inactive" as Id<"projects">, isActive: false },
    ]);

    await expect(runQueryHandler(listActive, ctx, {})).resolves.toEqual([
      { _id: activeId, isActive: true },
    ]);
    expect(collect).toHaveBeenCalledOnce();
  });

  it("continues rejecting an authenticated unverified user", async () => {
    authMocks.getValidAuthUserId.mockResolvedValue(userId);
    authMocks.getCurrentUser.mockRejectedValue(new Error("E-posta adresinizi doğrulamanız gerekiyor"));
    const { ctx } = queryContext();

    await expect(runQueryHandler(listActive, ctx, {})).rejects.toThrow("E-posta adresinizi doğrulamanız gerekiyor");
    await expect(runQueryHandler(listIdeSyncIssues, ctx, {})).rejects.toThrow("E-posta adresinizi doğrulamanız gerekiyor");
    await expect(runQueryHandler(listHikvisionSyncIssues, ctx, {})).rejects.toThrow("E-posta adresinizi doğrulamanız gerekiyor");
  });
});
