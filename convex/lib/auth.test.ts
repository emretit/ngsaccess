import { describe, expect, it, vi } from "vitest";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getCurrentUser, getValidAuthUserId } from "./auth";

const userId = "user-1" as Id<"users">;
const otherUserId = "user-2" as Id<"users">;
const sessionId = "session-1" as Id<"authSessions">;

function context(options: {
  subject?: string | null;
  sessionUserId?: Id<"users"> | null;
} = {}) {
  const subject = options.subject === undefined ? `${userId}|${sessionId}` : options.subject;
  const get = vi.fn(async (id: Id<"users"> | Id<"authSessions">) => {
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
