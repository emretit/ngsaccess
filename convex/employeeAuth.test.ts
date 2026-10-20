import { describe, expect, it, vi } from "vitest";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { consumeSetupToken, getByEmployee, getByToken, getByTokenInternal, signIn } from "./employeeAuth";

// These narrow DTO tests use a fake DB; transaction/limiter behavior is covered
// separately by employeeAuth.mobile.test.ts with the real component.
vi.mock("./lib/rateLimit", () => ({ limiter: { limit: async () => ({ ok: true }) } }));

type RegisteredQuery = {
  _handler: (ctx: QueryCtx, args: { token: string }) => Promise<unknown>;
  isInternal: boolean;
};

const registeredGetByEmployee = getByEmployee as unknown as { isInternal: boolean };
const registeredGetByTokenInternal = getByTokenInternal as unknown as { isInternal: boolean };
const publicTokenHandler = (getByToken as unknown as RegisteredQuery)._handler;

type RegisteredMutation = {
  _handler: (ctx: MutationCtx, args: { token: string; passwordHash: string }) => Promise<unknown>;
  isInternal: boolean;
};

type RegisteredSignIn = {
  _handler: (ctx: MutationCtx, args: { email: string; password: string }) => Promise<unknown>;
};

const consumeHandler = (consumeSetupToken as unknown as RegisteredMutation)._handler;
const signInHandler = (signIn as unknown as RegisteredSignIn)._handler;

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

function setupTokenFixture(expiresAt: string) {
  const record: Doc<"employeeAuth"> = {
    _id: "auth-record" as Id<"employeeAuth">,
    _creationTime: 1,
    employeeId: "employee" as Id<"employees">,
    passwordHash: "old-hash",
    setupToken: "setup-secret",
    tokenExpiresAt: expiresAt,
    createdAt: "2029-01-01T00:00:00.000Z",
    updatedAt: "2029-01-01T00:00:00.000Z",
  };
  const criteria: Record<string, unknown> = {};
  const patches: Array<{ id: Id<"employeeAuth">; patch: Record<string, unknown> }> = [];
  const query = {
    withIndex: (_name: string, apply: (builder: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
      apply({ eq: (field, value) => { criteria[field] = value; } });
      return query;
    },
    first: async () => criteria.setupToken === record.setupToken && record.setupToken !== undefined ? record : null,
  };
  const ctx = {
    db: {
      query: () => query,
      patch: async (id: Id<"employeeAuth">, patch: Record<string, unknown>) => {
        patches.push({ id, patch });
        Object.assign(record, patch);
      },
    },
  } as unknown as MutationCtx;
  return { ctx, record, patches };
}

describe("consumeSetupToken", () => {
  it("writes the password and consumes the token atomically", async () => {
    const { ctx, record } = setupTokenFixture("2030-01-01T00:00:00.000Z");

    await expect(consumeHandler(ctx, { token: "setup-secret", passwordHash: "new-hash" }))
      .resolves.toEqual({ status: "ok" });
    expect(record).toMatchObject({ passwordHash: "new-hash", setupToken: undefined, tokenExpiresAt: undefined });
    await expect(consumeHandler(ctx, { token: "setup-secret", passwordHash: "another-hash" }))
      .resolves.toEqual({ status: "invalid" });
    expect(record.passwordHash).toBe("new-hash");
  });

  it("does not write a password for an expired token", async () => {
    const { ctx, record, patches } = setupTokenFixture("2000-01-01T00:00:00.000Z");

    await expect(consumeHandler(ctx, { token: "setup-secret", passwordHash: "new-hash" }))
      .resolves.toEqual({ status: "expired" });
    expect(record.passwordHash).toBe("old-hash");
    expect(patches).toHaveLength(0);
  });
});

const testEmployee: Doc<"employees"> = {
  _id: "employee" as Id<"employees">,
  _creationTime: 1,
  firstName: "Test",
  lastName: "Employee",
  email: "employee@example.test",
  cardNumber: "123",
};

function signInFixture(options: { employee?: boolean; passwordHash?: string | null }) {
  const ctx = {
    db: {
      query: (table: string) => {
        let indexName = "";
        let indexedValue: unknown;
        const query = {
          withIndex: (name: string, apply: (builder: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
            indexName = name;
            apply({ eq: (_field, value) => { indexedValue = value; } });
            return query;
          },
          first: async () => {
            if (table === "employees" && indexName === "by_email" && indexedValue === "employee@example.test") {
              return options.employee === false ? null : testEmployee;
            }
            if (table === "employeeAuth" && indexName === "by_employee") {
              return options.passwordHash === undefined ? null : {
                _id: "auth-record" as Id<"employeeAuth">,
                _creationTime: 1,
                employeeId: testEmployee._id,
                ...(options.passwordHash === null ? {} : { passwordHash: options.passwordHash }),
                createdAt: "2029-01-01T00:00:00.000Z",
                updatedAt: "2029-01-01T00:00:00.000Z",
              };
            }
            return null;
          },
        };
        return query;
      },
    },
  } as unknown as MutationCtx;
  return ctx;
}

describe("employeeAuth signIn errors", () => {
  it("returns the same error for a missing employee, missing password, and wrong password", async () => {
    const args = { email: "employee@example.test", password: "wrong-password" };
    const expected = { error: { code: "INVALID_CREDENTIALS", message: "E-posta veya şifre hatalı" } };

    await expect(signInHandler(signInFixture({ employee: false }), args)).resolves.toEqual(expected);
    await expect(signInHandler(signInFixture({ passwordHash: undefined }), args)).resolves.toEqual(expected);
    await expect(signInHandler(signInFixture({ passwordHash: null }), args)).resolves.toEqual(expected);
    await expect(signInHandler(signInFixture({ passwordHash: "$2b$10$Oc3g9F8bRESoAK3pHZmgg.DudLaDxEGGGIZL4kHrbH1on0BK6pB4a" }), args))
      .resolves.toEqual(expected);
  });
});
