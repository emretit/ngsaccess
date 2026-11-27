import { describe, expect, it, vi } from "vitest";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { getForEmployee } from "./employeeDelivery";

type Ctx = QueryCtx & { user: Doc<"users"> };
type Handler = (ctx: Ctx, args: { employeeId: Id<"employees">; projectId: Id<"projects"> }) => Promise<unknown>;
vi.mock("./lib/customFunctions", () => ({ authedQuery: (definition: { handler: Handler }) => ({ _handler: definition.handler }) }));

type Row = Record<string, unknown> & { _id: string; _creationTime: number };
function fixture() {
  const tables = new Map<string, Row[]>();
  // Fixtures deliberately contain only the fields read by this query.
  const add = <Table extends TableNames>(table: Table, id: string, values: Record<string, unknown>): Row & Partial<Doc<Table>> => {
    const row = { _id: id, _creationTime: 1, ...values } as Row & Partial<Doc<Table>>;
    tables.set(table, [...tables.get(table) ?? [], row]); return row;
  };
  const takes: number[] = [];
  const db = {
    get: async (id: string) => [...tables.values()].flat().find(row => row._id === id) ?? null,
    normalizeId: (_table: string, value: string) => value,
    query: (table: string) => {
      const filters: [string, unknown][] = [];
      const builder = { eq: (field: string, value: unknown) => { filters.push([field, value]); return builder; } };
      let descending = false;
      const selected = () => (tables.get(table) ?? []).filter(row => filters.every(([field, value]) => row[field] === value)).sort((a, b) => descending ? b._creationTime - a._creationTime : 0);
      const chain = {
        withIndex: (_index: string, callback: (q: typeof builder) => unknown) => { callback(builder); return chain; },
        order: () => { descending = true; return chain; },
        take: async (limit: number) => { takes.push(limit); return selected().slice(0, limit); },
        unique: async () => selected()[0] ?? null,
        first: async () => selected()[0] ?? null,
      }; return chain;
    },
  };
  const user = add("users", "user", { role: "viewer" });
  add("userProjects", "membership", { userId: "user", projectId: "project", role: "viewer" });
  add("employees", "employee", { projectId: "project", firstName: "Ada", cardNumber: "123", isActive: true, updatedAt: new Date(1000).toISOString() });
  add("accessRules", "rule", { projectId: "project", isActive: true });
  add("groupMembers", "member", { projectId: "project", employeeId: "employee", groupId: "rule" });
  add("groupDevices", "link", { projectId: "project", groupId: "rule", deviceId: "device" });
  const device = add("devices", "device", { projectId: "project", name: "Panel", brand: "hikvision", isActive: true, password: "TOP_SECRET" });
  const ctx = { db, user } as unknown as Ctx;
  const invoke = (projectId = "project", employeeId = "employee") => (getForEmployee as unknown as { _handler: Handler })._handler(ctx, { projectId: projectId as Id<"projects">, employeeId: employeeId as Id<"employees"> });
  const grant = (state: string, extra: Record<string, unknown> = {}) => add("accessGrantStatus", "grant", { projectId: "project", employeeId: "employee", deviceId: "device", updatedAt: 2000, state, ...extra });
  const hik = (status: string, extra: Record<string, unknown> = {}) => add("hikPendingOperations", "hik", { projectId: "project", employeeId: "employee", deviceId: "device", operation: "addCard", payload: { employeeId: "employee", cardNumber: "123" }, status, createdAt: 3000, lastError: "TOP_SECRET", ...extra });
  return { invoke, add, grant, hik, device, tables, takes };
}

describe("kişi cihaz teslim sorgusu", () => {
  it("proje dışı kişi IDOR ve görüntüleme izni olmayan projeyi reddeder", async () => {
    const f = fixture();
    f.add("employees", "foreign", { projectId: "other" });
    await expect(f.invoke("project", "foreign")).rejects.toThrow("bu projede");
    await expect(f.invoke("other")).rejects.toThrow("yetkiniz yok");
    f.add("projectRolePermissions", "override", { projectId: "project", role: "viewer", permissions: [] });
    await expect(f.invoke()).rejects.toThrow("yetkiniz yok");
  });
  it("hiç gönderilmeyen hedefi gösterir, sır veya ham hata döndürmez", async () => {
    const f = fixture(); f.hik("failed");
    const result = await f.invoke();
    expect(result).toMatchObject({ devices: [{ state: "failed", retry: { source: "hikvision", id: "hik" } }] });
    expect(JSON.stringify(result)).not.toContain("TOP_SECRET");
    f.tables.set("hikPendingOperations", []);
    expect(await f.invoke()).toMatchObject({ devices: [{ state: "missing", lastAttemptAt: null, retry: null }] });
  });
  it.each(["effective", "pending", "failed"])("güncel kalıcı teslim durumunu korur: %s", async state => {
    const f = fixture(); f.grant(state);
    expect(await f.invoke()).toMatchObject({ devices: [{ state: state === "effective" ? "delivered" : state }] });
  });
  it("eski kartın ACK ve hatası yeni kartı teslim edilmiş veya retry yapılabilir göstermez", async () => {
    const f = fixture(); f.grant("effective", { updatedAt: 500 }); f.hik("done", { createdAt: 500 });
    expect(await f.invoke()).toMatchObject({ devices: [{ state: "missing", retry: null }] });
  });
  it("tek kart ACK'sını tam kişi/kart teslimi saymaz; gerçek deneme zamanını kullanır", async () => {
    const f = fixture(); f.hik("done", { processingStartedAt: 2500, completedAt: 3000 });
    expect(await f.invoke()).toMatchObject({ devices: [{ state: "missing", lastAttemptAt: 2500, lastResultAt: 3000 }] });
  });
  it("IDE ACK ve yeniden denemeyi doğrulanmış güncel kişi işleminden türetir", async () => {
    const f = fixture(); f.device.brand = "ide_smart";
    f.grant("pending", { lastOperationId: "ide" });
    const op = f.add("idePendingOperations", "ide", { projectId: "project", deviceId: "device", opType: "upsertUser", payload: { employeeId: "employee", userRecord: { id: 123 } }, status: "acked", sentAt: 2500, ackedAt: 3100, createdAt: 3000 });
    expect(await f.invoke()).toMatchObject({ devices: [{ state: "delivered", lastAttemptAt: 2500, retry: null }] });
    op.status = "failed";
    expect(await f.invoke()).toMatchObject({ devices: [{ state: "failed", retry: { source: "ide", id: "ide" } }] });
    op.projectId = "other" as Id<"projects">;
    expect(await f.invoke()).toMatchObject({ devices: [{ state: "pending", retry: null }] });
  });
  it("indeks alanı bulunmayan IDE erken ret kaydını sınırlı proje geçmişinden gösterir", async () => {
    const f = fixture(); f.device.brand = "ide_smart";
    f.hik("failed", { employeeId: undefined, payload: { employeeId: "employee" } });
    expect(await f.invoke()).toMatchObject({ devices: [{ state: "failed", retry: null }] });
  });
  it("eksik sonuç uyarısı verir ve tüm taramaları take ile sınırlar", async () => {
    const f = fixture();
    for (let index = 0; index < 25; index++) f.add("groupMembers", `member-${index}`, { projectId: "project", employeeId: "employee", groupId: "rule" });
    expect(await f.invoke()).toMatchObject({ incomplete: true });
    // Permission membership lookup has its own pre-existing 1000-row bound.
    expect(f.takes.every(limit => limit > 0 && limit <= 1000)).toBe(true);
    expect(f.takes.length).toBeLessThan(50);
  });
  it("önceki hedefe yeniden gönderme sunmaz ve proje dışı cihazı döndürmez", async () => {
    const f = fixture(); f.tables.set("groupDevices", []); f.hik("failed");
    expect(await f.invoke()).toMatchObject({ devices: [{ target: false, retry: null }] });
    f.device.projectId = "other" as Id<"projects">;
    expect(await f.invoke()).toMatchObject({ devices: [] });
  });
  it("pasif kişiye başarısız ekleme işlemini tekrar göndermez", async () => {
    const f = fixture(); f.hik("failed");
    const employee = f.tables.get("employees")?.[0];
    if (employee) employee.isActive = false;
    expect(await f.invoke()).toMatchObject({ devices: [{ target: false, retry: null }] });
  });
});

it("D9: unrelated edits keep confirmed delivery; device edits invalidate it", async () => {
  const f = fixture(); f.grant("effective");
  const employee = f.tables.get("employees")?.[0];
  if (!employee) throw new Error("fixture");
  employee.updatedAt = new Date(9000).toISOString(); employee.deviceSyncUpdatedAt = 1000;
  expect(await f.invoke()).toMatchObject({ devices: [{ state: "delivered" }] });
  employee.deviceSyncUpdatedAt = 9000;
  expect(await f.invoke()).toMatchObject({ devices: [{ state: "missing" }] });
});
it("D9: matches imported person-only operations using hikEmployeeNo", async () => {
  const f = fixture();
  Object.assign(f.tables.get("employees")?.[0] ?? {}, { cardNumber: "", hikEmployeeNo: "7" });
  f.hik("failed", { operation: "addPerson", payload: { employeeId: "employee", employeeNo: "7" } });
  expect(await f.invoke()).toMatchObject({ devices: [{ state: "failed", retry: { source: "hikvision" } }] });
});
it("D9: IDE card_invalid appears as failure without a retry until the card is corrected", async () => {
  const f = fixture(); f.device.brand = "ide_smart";
  Object.assign(f.tables.get("employees")?.[0] ?? {}, { cardNumber: "ABC" });
  f.add("idePendingOperations", "invalid", { projectId: "project", deviceId: "device", opType: "upsertUser", idempotencyKey: "device:invalidCard:employee", payload: { employeeId: "employee", errorCode: "card_invalid" }, status: "failed", createdAt: 3000 });
  expect(await f.invoke()).toMatchObject({ devices: [{ state: "failed", retry: null }] });
  Object.assign(f.tables.get("employees")?.[0] ?? {}, { cardNumber: "123" });
  expect(await f.invoke()).toMatchObject({ devices: [{ state: "missing" }] });
});
