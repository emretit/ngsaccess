import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { visitorTimeISO, visitorSensitiveFields, maskedVisitorCard, visitorMatchesSearch, visitorStatus, visitorTime, visitorUpdateExpiryError } from "./visitorStatus";

const now = Date.parse("2026-10-17T07:00:00Z");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { vi.useRealTimers(); });
describe("ziyaretçi erişim sözleşmesi", () => {
  it("sonlandırma etiketi süre dolsa da korunur; erişim konumdan bağımsızdır", () => {
    expect(visitorStatus({ isActive: false, visitorStatus: "checkedOut", accessExpiresAt: "2020-01-01T00:00:00Z" }, now)).toBe("checkedOut");
    expect(visitorStatus({ isActive: true, accessExpiresAt: "2026-10-17T10:00" }, now)).toBe("expired");
    expect(visitorStatus({ isActive: true, accessExpiresAt: "2026-10-17T10:01" }, now)).toBe("active");
    expect(visitorStatus({ isActive: false, visitorStatus: "preRegistered" }, now)).toBe("preRegistered");
    expect(visitorStatus({ isActive: false }, now)).toBe("checkedOut");
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
  const visitor = { _id: "visitor", _creationTime: 1, projectId: "project", isVisitor: true, firstName: "Ada", lastName: "Test", email: "",
    cardNumber: "12345678", tcNo: "12345678901", accessStartsAt: "2026-10-17T09:00", accessExpiresAt: "2026-10-17T10:00" };
  const query = (table: string) => {
    const chain = { withIndex: () => chain, order: () => chain, first: async () => null, take: async () => [],
      paginate: async () => ({ page: [visitor], isDone: true, continueCursor: "done" }),
      async *[Symbol.asyncIterator]() { if (table === "employees") yield visitor; },
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
        collect: async () => [],
        paginate: async () => ({ page: table === "employees" ? rows.filter(row => row.accessExpiresAt <= upperBound) : [], isDone: true, continueCursor: "done" }),
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

// A small indexed database transport exercises the real stream cursor/filter implementation.
function visitorQueryFixture(employees: Record<string, unknown>[], extra: Record<string, Record<string, unknown>[]> = {}) {
  const tables: Record<string, Record<string, unknown>[]> = { employees, ...extra };
  const queriedTables: string[] = [];
  const indexes: string[] = [];
  const query = (table: string) => {
    queriedTables.push(table);
    let rows = [...(tables[table] ?? [])];
    let fields = ["_creationTime", "_id"];
    const compare = (left: unknown, right: unknown) => left === right ? 0 : left === undefined ? -1 : right === undefined ? 1 : typeof left === "number" && typeof right === "number" ? left - right : String(left) < String(right) ? -1 : 1;
    const range = {
      eq(field: string, value: unknown) { rows = rows.filter(row => row[field] === value); return range; },
      gt(field: string, value: unknown) { rows = rows.filter(row => compare(row[field], value) > 0); return range; },
      gte(field: string, value: unknown) { rows = rows.filter(row => compare(row[field], value) >= 0); return range; },
      lt(field: string, value: unknown) { rows = rows.filter(row => compare(row[field], value) < 0); return range; },
      lte(field: string, value: unknown) { rows = rows.filter(row => compare(row[field], value) <= 0); return range; },
    };
    const chain = {
      withIndex(name: string, apply?: (q: typeof range) => unknown) {
        indexes.push(name);
        fields = name === "by_project_visitor_status_expiry" ? ["projectId", "isVisitor", "visitorStatus", "accessExpiresAt", "_creationTime", "_id"] : name === "by_project_visitor_expiry" ? ["projectId", "isVisitor", "accessExpiresAt", "_creationTime", "_id"] : ["projectId", "isVisitor", "_creationTime", "_id"];
        apply?.(range); return chain;
      },
      order(direction: string) { rows.sort((a, b) => {
        for (const field of fields) { const diff = typeof a[field] === "number" && typeof b[field] === "number" ? Number(a[field]) - Number(b[field]) : compare(a[field], b[field]); if (diff) return direction === "desc" ? -diff : diff; }
        return 0;
      }); return chain; },
      first: async () => rows[0] ?? null,
      take: async (count: number) => rows.slice(0, count),
      collect: async () => [...rows],
      async *[Symbol.asyncIterator]() { yield* rows; },
    };
    return chain;
  };
  const insert = vi.fn(async () => "new-record");
  const context = { user: { _id: "admin", role: "project_admin" }, db: {
    query, get: async (id: string) => Object.values(tables).flat().find(row => row._id === id) ?? null,
    patch: vi.fn(), insert,
  }, scheduler: { runAfter: vi.fn() } };
  return { ctx: context as unknown as QueryCtx & MutationCtx, insert, indexes, queriedTables };
}
const visitorRecord = (index: number, overrides: Record<string, unknown> = {}) => ({
  _id: `visitor-${index}`, _creationTime: index, projectId: "project", isVisitor: true,
  firstName: "Ada", lastName: `Test ${index}`, email: "visit@ngsaccess.local", cardNumber: `${index}`,
  isActive: true, visitorStatus: "checkedIn", accessExpiresAt: "2099-01-01T00:00:00.000Z", hourlyRate: 500,
  ...overrides,
});
const invokeVisitor = <T,>(fn: unknown, ctx: QueryCtx | MutationCtx, args: object): Promise<T> =>
  (fn as { _handler: (ctx: QueryCtx | MutationCtx, args: object) => Promise<T> })._handler(ctx, args);
import { summary, kvkkNotice, update, presetRules } from "../visitors";

it("search fills real cursor pages from all project records, including matches beyond 25 rows", async () => {
  const employees = Array.from({ length: 80 }, (_, index) => visitorRecord(index, { firstName: index < 30 ? "İpek" : "Başka" }));
  const { ctx } = visitorQueryFixture([...employees, visitorRecord(900, { projectId: "other", firstName: "İpek" })]);
  type Page = { page: { _id: string; cardNumber: string }[]; isDone: boolean; continueCursor: string; searchScope: string };
  const first = await invokeVisitor<Page>(listPage, ctx, { projectId: "project", search: "ipek", now, paginationOpts: { numItems: 25, cursor: null } });
  const second = await invokeVisitor<Page>(listPage, ctx, { projectId: "project", search: "ipek", now, paginationOpts: { numItems: 25, cursor: first.continueCursor } });
  expect(first.page).toHaveLength(25);
  expect(second.page).toHaveLength(5);
  expect(first.isDone).toBe(false); expect(second.isDone).toBe(true);
  expect(new Set([...first.page, ...second.page].map(row => row._id)).size).toBe(30);
  expect(first.searchScope).toBe("project");
  expect(first.page[0]).not.toHaveProperty("hourlyRate");
  expect(first.page[0].cardNumber).toContain("••••");
});

it("expiry filtering uses the time-range index before pagination and excludes terminated records", async () => {
  const employees = [visitorRecord(1, { accessExpiresAt: "2026-10-17T10:00" }), visitorRecord(2, { accessExpiresAt: "2026-10-17T07:00:00.000Z" }), visitorRecord(3, { accessExpiresAt: "2020-01-01T00:00:00Z", visitorStatus: "checkedOut" }), visitorRecord(4)];
  const { ctx, indexes } = visitorQueryFixture(employees);
  const page = await invokeVisitor<{ page: { _id: string; status: string }[] }>(listPage, ctx, { projectId: "project", status: "expired", now, paginationOpts: { numItems: 25, cursor: null } });
  expect(page.page.map(row => row._id).sort()).toEqual(["visitor-1", "visitor-2"]);
  expect(indexes).toContain("by_project_visitor_expiry");
  expect(page.page.every(row => row.status === "expired")).toBe(true);
});

it("summary counts all records beyond 500 without presence N+1 reads and returns nearest expiry", async () => {
  const next = now + 1000;
  const employees = Array.from({ length: 600 }, (_, index) => visitorRecord(index));
  employees.push(visitorRecord(601, { accessExpiresAt: new Date(next).toISOString() }), visitorRecord(602, { isActive: false, visitorStatus: "preRegistered" }), visitorRecord(603, { visitorStatus: "checkedOut" }), visitorRecord(604, { accessExpiresAt: "2020-01-01T00:00:00Z" }));
  const { ctx, queriedTables } = visitorQueryFixture(employees);
  expect(await invokeVisitor(summary, ctx, { projectId: "project", now })).toMatchObject({ total: 604, counts: { active: 601, preRegistered: 1, checkedOut: 1, expired: 1 }, nextExpiry: next });
  expect(queriedTables).not.toContain("cardReadings");
});

it("KVKK shows no invented notice and snapshots configured URL and version into the consent", async () => {
  const employee = visitorRecord(1, { accessRuleId: "rule" });
  const rule = { _id: "rule", projectId: "project", targetType: "visitor" };
  const unconfigured = visitorQueryFixture([employee], { accessRules: [rule] });
  expect(await invokeVisitor(kvkkNotice, unconfigured.ctx, { projectId: "project" })).toEqual({ url: null, version: null });
  await expect(invokeVisitor(update, unconfigured.ctx, { visitorId: "visitor-1", kvkkConsent: true })).rejects.toThrow("Aydınlatma metni henüz tanımlanmadı");
  const configured = visitorQueryFixture([employee], { accessRules: [rule], projectPrivacySettings: [{ projectId: "project", visitorKvkkUrl: "https://example.org/notice", visitorKvkkVersion: "2026-1" }] });
  await expect(invokeVisitor(update, configured.ctx, { visitorId: "visitor-1", kvkkConsent: true, kvkkDocumentVersion: "old" })).rejects.toThrow("Aydınlatma metni güncellendi");
  await invokeVisitor(update, configured.ctx, { visitorId: "visitor-1", kvkkConsent: true, kvkkDocumentVersion: "2026-1" });
  expect(configured.insert).toHaveBeenCalledWith("employeeConsents", expect.objectContaining({ documentUrl: "https://example.org/notice", documentVersion: "2026-1", employeeId: "visitor-1" }));
});

it("preset regions expose doorless regions as unavailable", async () => {
  const { ctx } = visitorQueryFixture([], { accessRules: [{ _id: "rule", projectId: "project", targetType: "visitor", name: "Kapısız" }] });
  expect(await invokeVisitor(presetRules, ctx, { projectId: "project" })).toMatchObject([{ name: "Kapısız", hasDoors: false }]);
});

it("expired cursor merges extended historic expiry and exact boundary records without duplicates", async () => {
  const employees = Array.from({ length: 30 }, (_, index) => visitorRecord(index, { visitorStatus: "expired" }));
  employees.push(visitorRecord(31, { accessExpiresAt: new Date(now).toISOString() }));
  const { ctx } = visitorQueryFixture(employees);
  type Page = { page: { _id: string }[]; continueCursor: string; isDone: boolean };
  const first = await invokeVisitor<Page>(listPage, ctx, { projectId: "project", status: "expired", now, paginationOpts: { numItems: 25, cursor: null } });
  const second = await invokeVisitor<Page>(listPage, ctx, { projectId: "project", status: "expired", now, paginationOpts: { numItems: 25, cursor: first.continueCursor } });
  expect(first.page).toHaveLength(25); expect(second.page).toHaveLength(6);
  expect(new Set([...first.page, ...second.page].map(row => row._id)).size).toBe(31);
  expect(second.isDone).toBe(true);
});
it("active filtering retains legacy visitors without an expiry", async () => {
  const { ctx } = visitorQueryFixture([visitorRecord(1, { accessExpiresAt: undefined }), visitorRecord(2)]);
  const page = await invokeVisitor<{ page: unknown[] }>(listPage, ctx, { projectId: "project", status: "active", now, paginationOpts: { numItems: 25, cursor: null } });
  expect(page.page).toHaveLength(2);
});

it.each([-1, 1])("list and summary clamp a wildly inaccurate client clock (%s)", async direction => {
  const { ctx } = visitorQueryFixture([visitorRecord(1, { isActive: true, accessExpiresAt: new Date(now + 10 * 60 * 1000).toISOString() })]);
  const requested = now + direction * 24 * 60 * 60 * 1000;
  const expected = new Date(now + direction * 5 * 60 * 1000).toISOString();
  const page = await invokeVisitor<{ evaluatedAt: string; page: { status: string }[] }>(listPage, ctx, { projectId: "project", status: "active", now: requested, paginationOpts: { numItems: 25, cursor: null } });
  expect(page.evaluatedAt).toBe(expected);
  expect(page.page).toHaveLength(1);
  expect(await invokeVisitor(summary, ctx, { projectId: "project", now: requested })).toMatchObject({ evaluatedAt: expected, counts: { active: 1, expired: 0 } });
});

it("manually inactive records use the same terminated bucket in list and summary", async () => {
  const { ctx } = visitorQueryFixture([visitorRecord(1, { isActive: false, visitorStatus: undefined })]);
  expect(await invokeVisitor(listPage, ctx, { projectId: "project", status: "checkedOut", now, paginationOpts: { numItems: 25, cursor: null } })).toMatchObject({ page: [{ status: "checkedOut" }] });
  expect(await invokeVisitor(summary, ctx, { projectId: "project", now })).toMatchObject({ counts: { checkedOut: 1, active: 0 } });
});
