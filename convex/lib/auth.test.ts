import { describe, expect, it, vi } from "vitest";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentUser, getProjectIdsForUser, getValidAuthUserId } from "./auth";

const userId = "user-1" as Id<"users">;
const otherUserId = "user-2" as Id<"users">;
const sessionId = "session-1" as Id<"authSessions">;

function context(options: {
  subject?: string | null;
  sessionUserId?: Id<"users"> | null;
} = {}) {
  const subject = options.subject === undefined ? `${userId}|${sessionId}` : options.subject;
  const get = vi.fn(async (id: Id<"users"> | Id<"authSessions">): Promise<unknown> => {
    if (id === sessionId) {
      return options.sessionUserId === null
        ? null
        : { _id: sessionId, userId: options.sessionUserId ?? userId, expirationTime: Date.now() + 60_000 };
    }
    if (id === userId) return { _id: userId, _creationTime: 1, email: "user@example.test", verified: true };
    return null;
  });
  return {
    ctx: {
      auth: { getUserIdentity: async () => subject === null ? null : { subject } },
      db: { get },
    } as unknown as QueryCtx,
    get,
  };
}

describe("getValidAuthUserId", () => {
  it("returns null without a JWT identity", async () => {
    await expect(getValidAuthUserId(context({ subject: null }).ctx)).resolves.toBeNull();
  });

  it("returns null when the JWT has no session id", async () => {
    await expect(getValidAuthUserId(context({ subject: `${userId}` }).ctx)).resolves.toBeNull();
  });

  it("returns null when the session document was deleted", async () => {
    await expect(getValidAuthUserId(context({ sessionUserId: null }).ctx)).resolves.toBeNull();
  });

  it("returns null when the session belongs to another user", async () => {
    await expect(getValidAuthUserId(context({ sessionUserId: otherUserId }).ctx)).resolves.toBeNull();
  });

  it("returns the user id when the session belongs to that user", async () => {
    await expect(getValidAuthUserId(context().ctx)).resolves.toBe(userId);
  });

  it("makes getCurrentUser reject a deleted session as unauthenticated", async () => {
    const { ctx, get } = context({ sessionUserId: null });
    await expect(getCurrentUser(ctx)).rejects.toThrow("Giriş yapmanız gerekiyor");
    expect(get).toHaveBeenCalledOnce();
  });
});


describe("getProjectIdsForUser", () => {
  const projectId = "project-1" as Id<"projects">;
  const user: Doc<"users"> = { _id: userId, _creationTime: 1, verified: true, role: "project_user" };

  function projectContext(role: Doc<"users">["role"], cached: boolean | null = true) {
    const { ctx, get } = context();
    const collect = vi.fn(async () => role === "super_admin" ? [{ _id: projectId }] : [{ projectId }]);
    const eq = vi.fn();
    const query = vi.fn(() => ({
      collect,
      withIndex: (_name: string, predicate: (q: { eq: typeof eq }) => unknown) => {
        predicate({ eq });
        return { collect };
      },
    }));
    const currentUser = { ...user, role };
    get.mockImplementation(async id => id === userId ? currentUser : {
      _id: sessionId, userId, expirationTime: Date.now() + 60_000,
    });
    return {
      ctx: { ...ctx, db: { ...ctx.db, query }, ...(cached === true ? { user: currentUser } : cached === null ? { user: null } : {}) } as unknown as QueryCtx & { user?: Doc<"users"> | null },
      get, query, eq,
    };
  }

  it.each(["super_admin", "project_admin", "project_user"] as const)("reuses validated %s without session/user reads and preserves project scope", async role => {
    const cached = projectContext(role);
    const fallback = projectContext(role, false);
    await expect(getProjectIdsForUser(cached.ctx)).resolves.toEqual([projectId]);
    await expect(getProjectIdsForUser(fallback.ctx)).resolves.toEqual([projectId]);
    expect(cached.get).not.toHaveBeenCalled();
    expect(fallback.get.mock.calls.map(([id]) => id)).toEqual([sessionId, userId]);
    expect(cached.query).toHaveBeenCalledWith(role === "super_admin" ? "projects" : "userProjects");
    if (role !== "super_admin") expect(cached.eq).toHaveBeenCalledWith("userId", userId);
  });

  it("validates sessions when ctx.user is null and rejects a missing session", async () => {
    const fallback = projectContext("project_user", null);
    await expect(getProjectIdsForUser(fallback.ctx)).resolves.toEqual([projectId]);
    expect(fallback.get).toHaveBeenCalledTimes(2);
    await expect(getProjectIdsForUser(context({ sessionUserId: null }).ctx)).rejects.toThrow("Giriş yapmanız gerekiyor");
  });

  it("does not allow an unverified user supplied by optionalAuthQuery", async () => {
    const { ctx, query } = projectContext("project_user");
    await expect(getProjectIdsForUser({ ...ctx, user: { ...user, verified: false } })).rejects.toThrow("E-posta adresinizi doğrulamanız gerekiyor");
    expect(query).not.toHaveBeenCalled();
  });
});
