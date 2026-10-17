import { describe, expect, it, vi } from "vitest";
import { visitorTimeISO, visitorSensitiveFields, maskedVisitorCard, visitorMatchesSearch, visitorStatus, visitorTime, visitorUpdateExpiryError } from "./visitorStatus";

const now = Date.parse("2026-10-17T07:00:00Z");
describe("ziyaretçi erişim sözleşmesi", () => {
  it("sonlandırma etiketi süre dolsa da korunur; erişim konumdan bağımsızdır", () => {
    expect(visitorStatus({ isActive: false, visitorStatus: "checkedOut", accessExpiresAt: "2020-01-01T00:00:00Z" }, now)).toBe("checkedOut");
    expect(visitorStatus({ isActive: true, accessExpiresAt: "2026-10-17T10:00" }, now)).toBe("expired");
    expect(visitorStatus({ isActive: true, accessExpiresAt: "2026-10-17T10:01" }, now)).toBe("active");
    expect(visitorStatus({ isActive: false, visitorStatus: "preRegistered" }, now)).toBe("preRegistered");
    expect(visitorStatus({ isActive: false }, now)).toBe("inactive");
    expect(visitorStatus({ isActive: false, visitorStatus: "expired" }, now)).toBe("expired");
  });
  it("yerel TR saati ve ofset aynı anı ifade eder; geçersiz gün reddedilir", () => {
    expect(visitorTime("2026-10-17T10:00")).toBe(now);
    expect(visitorTime("2026-10-17T10:00:00+03:00")).toBe(now);
    expect(visitorTime("2026-10-17T07:00:00Z")).toBe(now);
    expect(visitorTime("2026-02-30T10:00")).toBeNaN();
    expect(visitorTime("2026-10-17T24:00")).toBeNaN();
    expect(visitorTime("bad")).toBeNaN();
  });
  it("geçmişi düzenler ama geçmiş bitişle aktivasyon yapmaz", () => {
    const current = { isActive: false, accessExpiresAt: "2020-01-01T00:00:00Z" };
    expect(visitorUpdateExpiryError(current, {}, now)).toBeNull();
    expect(visitorUpdateExpiryError(current, { accessExpiresAt: current.accessExpiresAt }, now)).toBeNull();
    expect(visitorUpdateExpiryError(current, { isActive: true }, now)).toBeTruthy();
    expect(visitorUpdateExpiryError(current, { isActive: true, accessExpiresAt: "2026-10-17T10:01" }, now)).toBeNull();
    expect(visitorUpdateExpiryError(current, { accessExpiresAt: "invalid" }, now)).toBeTruthy();
  });
  it("Türkçe ad, tam ad, şirket ve gerçek kartla arar; kartı maskeler", () => {
    const visitor = { firstName: "IŞIL", lastName: "İnce", visitorCompany: "ŞİRKET", cardNumber: "12345678" };
    for (const term of [" ışıl ", "ışıl ince", "şirket", "12345678"]) expect(visitorMatchesSearch(visitor, term)).toBe(true);
    expect(visitorMatchesSearch(visitor, "başka")).toBe(false);
    expect(maskedVisitorCard(visitor.cardNumber)).toBe("•••• 5678");
    expect(maskedVisitorCard("IADE:12345678:some-id")).toBe("İade edildi");
  });
});


it("legacy TR expiry and UTC ISO yield identical status and normalized edit values", () => {
  for (const [local, iso] of [["2026-10-17T10:00", "2026-10-17T07:00:00.000Z"],
    ["2026-10-17T10:01", "2026-10-17T07:01:00.000Z"]]) {
    expect(visitorTimeISO(local)).toBe(iso);
    expect(visitorTimeISO(iso)).toBe(iso);
    expect(visitorStatus({ isActive: true, accessExpiresAt: local }, now))
      .toBe(visitorStatus({ isActive: true, accessExpiresAt: iso }, now));
  }
  expect(visitorTimeISO("bad")).toBeNull();
});

it("only administrators receive complete card and identity numbers", () => {
  const visitor = { cardNumber: "12345678", tcNo: "12345678901" };
  expect(visitorSensitiveFields(visitor, false)).toEqual({ cardNumber: "•••• 5678", tcNo: "•••• 8901", sensitiveMasked: true });
  expect(visitorSensitiveFields(visitor, true)).toEqual({ ...visitor, sensitiveMasked: false });
  expect(visitorSensitiveFields({ cardNumber: "IADE:12345678:id" }, false)).toEqual({ cardNumber: "İade edildi", tcNo: null, sensitiveMasked: true });
});

// Real query wrappers, with identity/project lookup and DB transport replaced only.
vi.mock("./auth", async importOriginal => ({
  ...await importOriginal<typeof import("./auth")>(),
  getCurrentUser: vi.fn(async (ctx: { user: { role: string } }) => ctx.user),
  getProjectIdsForUser: vi.fn(async () => ["project"]),
}));
import { expireVisitorAccess, getDetail, listPage } from "../visitors";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

it("detail enforces role masking and both endpoints return normalized expiry", async () => {
  const visitor = { _id: "visitor", projectId: "project", isVisitor: true, firstName: "Ada", lastName: "Test", email: "",
    cardNumber: "12345678", tcNo: "12345678901", accessStartsAt: "2026-10-17T09:00", accessExpiresAt: "2026-10-17T10:00" };
  const query = () => {
    const chain = { withIndex: () => chain, order: () => chain, first: async () => null, take: async () => [],
      paginate: async () => ({ page: [visitor], isDone: true, continueCursor: "done" }),
      async *[Symbol.asyncIterator]() { /* no consent rows */ },
    };
    return chain;
  };
  const ctx = { user: { role: "member" }, db: { get: async () => visitor, query } };
  const detail = (getDetail as unknown as { _handler: (ctx: QueryCtx, args: { visitorId: Id<"employees"> }) => Promise<Record<string, unknown>> })._handler;
  for (const role of ["member", "project_admin", "super_admin"]) {
    ctx.user.role = role;
    const result = await detail(ctx as unknown as QueryCtx, { visitorId: "visitor" as Id<"employees"> });
    expect(result).toMatchObject({ sensitiveMasked: role === "member", cardNumber: role === "member" ? "•••• 5678" : visitor.cardNumber,
      tcNo: role === "member" ? "•••• 8901" : visitor.tcNo, visitEnd: "2026-10-17T07:00:00.000Z", visitStart: "2026-10-17T06:00:00.000Z" });
  }
  const page = (listPage as unknown as { _handler: (ctx: QueryCtx, args: object) => Promise<{ page: Record<string, unknown>[] }> })._handler;
  expect((await page(ctx as unknown as QueryCtx, { projectId: "project", paginationOpts: { numItems: 10, cursor: null } })).page[0])
    .toMatchObject({ cardNumber: "•••• 5678", visitEnd: "2026-10-17T07:00:00.000Z" });
});


it("expiry cron includes legacy TR and UTC records at the same instant without expiring future candidates", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  try {
    const rows = [
      { _id: "legacy", isVisitor: true, isActive: true, accessExpiresAt: "2026-10-17T10:00" },
      { _id: "iso", isVisitor: true, isActive: true, accessExpiresAt: "2026-10-17T07:00:00.000Z" },
      { _id: "future", isVisitor: true, isActive: true, accessExpiresAt: "2026-10-17T08:00:00.000Z" },
      { _id: "invalid", isVisitor: true, isActive: true, accessExpiresAt: "bad" },
    ];
    let upperBound = "";
    const query = (table: string) => {
      const bounds = { eq: () => bounds, lte: (_field: string, value: string) => { upperBound = value; return bounds; } };
      const chain = { withIndex: (_index: string, apply: (q: typeof bounds) => unknown) => { apply(bounds); return chain; },
        collect: async () => table === "employees" ? rows.filter(row => row.accessExpiresAt <= upperBound) : [],
      };
      return chain;
    };
    const patch = vi.fn();
    const runAfter = vi.fn();
    const handler = (expireVisitorAccess as unknown as { _handler: (ctx: MutationCtx, args: object) => Promise<{ expired: number }> })._handler;
    expect(await handler({ db: { query, patch }, scheduler: { runAfter } } as unknown as MutationCtx, {})).toEqual({ expired: 2 });
    expect(upperBound).toBe("2026-10-17T10:00:00.000Z");
    expect(patch.mock.calls.map(([id]) => id)).toEqual(["legacy", "iso"]);
    expect(runAfter).toHaveBeenCalledTimes(2);
  } finally { vi.useRealTimers(); }
});
