import { describe, expect, it, vi } from "vitest";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { currentUser, list } from "./users";

vi.mock("./lib/customFunctions", () => {
  const register = (definition: { handler: unknown }) => ({ _handler: definition.handler });
  return {
    optionalAuthQuery: register,
    adminQuery: register,
    superAdminQuery: register,
    authedMutation: register,
    superAdminMutation: register,
  };
});

const userId = "user-1" as Id<"users">;
const otherUserId = "user-2" as Id<"users">;
const sessionId = "session" as Id<"authSessions">;
const projectId = "project-1" as Id<"projects">;

type HandlerContext = QueryCtx & { user: Doc<"users"> };
type Handler<A, R> = { _handler: (ctx: HandlerContext, args: A) => Promise<R> };

const currentUserHandler = (currentUser as unknown as Handler<Record<string, never>, Doc<"users"> | null>)._handler;
const listHandler = (list as unknown as Handler<Record<string, never>, Doc<"users">[]>)._handler;

function makeUser(id: Id<"users">, role: Doc<"users">["role"] = "project_user"): Doc<"users"> {
  return {
    _id: id,
    _creationTime: 1,
    email: `${id}@example.test`,
    name: "Test User",
    fullName: "Test User",
    role,
    verified: true,
    setupToken: "verification-secret",
    tokenExpiresAt: "2030-01-01T00:00:00.000Z",
  };
}

function queryResult(records: Record<string, unknown>[]) {
  let userIdFilter: unknown;
  let projectIdFilter: unknown;
  const result = {
    withIndex: (_name: string, apply: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
      apply({ eq: (field, value) => {
        if (field === "userId") userIdFilter = value;
        if (field === "projectId") projectIdFilter = value;
        return undefined;
      } });
      return result;
    },
    collect: async () => records.filter((row) =>
      (userIdFilter === undefined || row.userId === userIdFilter) &&
      (projectIdFilter === undefined || row.projectId === projectIdFilter)),
  };
  return result;
}

function makeContext(options: {
  caller: Doc<"users">;
  users: Doc<"users">[];
  memberships?: { userId: Id<"users">; projectId: Id<"projects"> }[];
}) {
  const memberships = options.memberships ?? [];
  const db = {
    get: async (id: Id<"users"> | Id<"authSessions">) => id === sessionId
      ? { _id: sessionId, userId: options.caller._id, expirationTime: Date.now() + 60_000 }
      : options.users.find((user) => user._id === id) ?? null,
    query: (table: string) => queryResult(table === "userProjects"
      ? memberships
      : options.users),
  };
  return {
    user: options.caller,
    auth: { getUserIdentity: async () => ({
      subject: `${options.caller._id}|session`,
      issuer: "https://auth.example.test",
      tokenIdentifier: `auth|${options.caller._id}`,
    }) },
    db,
  } as unknown as HandlerContext;
}

describe("public user queries", () => {
  it("currentUser omits verification secrets and retains profile fields", async () => {
    const user = makeUser(userId);
    const result = await currentUserHandler({ user, db: {} } as unknown as HandlerContext, {});
    expect(result).toMatchObject({ email: user.email, role: user.role, verified: true, name: user.name });
    expect(result).not.toHaveProperty("setupToken");
    expect(result).not.toHaveProperty("tokenExpiresAt");
  });

  it("list strips sensitive fields for super admins and project admins", async () => {
    const target = makeUser(otherUserId);
    const superAdmin = makeUser(userId, "super_admin");
    const superAdminResult = await listHandler(makeContext({ caller: superAdmin, users: [superAdmin, target] }), {});
    expect(superAdminResult).toHaveLength(2);
    expect(superAdminResult[1]).not.toHaveProperty("setupToken");
    expect(superAdminResult[1]).not.toHaveProperty("tokenExpiresAt");

    const projectAdmin = makeUser(userId, "project_admin");
    const projectContext = makeContext({
      caller: projectAdmin,
      users: [projectAdmin, target],
      memberships: [{ userId, projectId }, { userId: otherUserId, projectId }],
    });
    const result = await listHandler(projectContext, {});
    expect(result.map((user) => user._id)).toContain(otherUserId);
    expect(result.every((user) => !("setupToken" in user) && !("tokenExpiresAt" in user))).toBe(true);
  });

});
