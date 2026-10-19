import { describe, expect, it } from "vitest";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getByEmployee, getByToken, getByTokenInternal } from "./employeeAuth";

type RegisteredQuery = {
  _handler: (ctx: QueryCtx, args: { token: string }) => Promise<unknown>;
  isInternal: boolean;
};

const registeredGetByEmployee = getByEmployee as unknown as { isInternal: boolean };
const registeredGetByTokenInternal = getByTokenInternal as unknown as { isInternal: boolean };
const publicTokenHandler = (getByToken as unknown as RegisteredQuery)._handler;

function fixture(options: { missing?: boolean } = {}) {
  const record: Doc<"employeeAuth"> = {
    _id: "auth-record" as Id<"employeeAuth">,
    _creationTime: 1,
    employeeId: "employee" as Id<"employees">,
    email: "employee@example.test",
    passwordHash: "sensitive-hash",
    setupToken: "setup-secret",
    tokenExpiresAt: "2030-01-01T00:00:00.000Z",
    createdAt: "2029-01-01T00:00:00.000Z",
    updatedAt: "2029-01-01T00:00:00.000Z",
  };
  const criteria: Record<string, unknown> = {};
  const query = {
    withIndex: (_name: string, apply: (builder: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
      apply({ eq: (field, value) => { criteria[field] = value; } });
      return query;
    },
    first: async () => options.missing || criteria.setupToken !== record.setupToken ? null : record,
  };
  const ctx = {
    db: { query: (table: string) => table === "employeeAuth" ? query : null },
  } as unknown as QueryCtx;
  return { ctx };
}

describe("employeeAuth public token lookup", () => {
  it("keeps raw auth lookups internal", () => {
    expect(registeredGetByEmployee.isInternal).toBe(true);
    expect(registeredGetByTokenInternal.isInternal).toBe(true);
  });

  it("returns only tokenExpiresAt and email for a matching setup token", async () => {
    const { ctx } = fixture();
    const result = await publicTokenHandler(ctx, { token: "setup-secret" });
    expect(result).toEqual({ tokenExpiresAt: "2030-01-01T00:00:00.000Z", email: "employee@example.test" });
    expect(Object.keys(result as Record<string, unknown>)).toEqual(["tokenExpiresAt", "email"]);
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("setupToken");
    expect(result).not.toHaveProperty("employeeId");
  });

  it("returns null when no auth record matches", async () => {
    const { ctx } = fixture({ missing: true });
    await expect(publicTokenHandler(ctx, { token: "unknown-token" })).resolves.toBeNull();
  });
});
