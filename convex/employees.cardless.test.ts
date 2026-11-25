import { describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionArgs } from "convex/server";
import { create, update } from "./employees";
import { assignCards } from "./employeeImport";
import type { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

type TestCtx = MutationCtx & { user: Doc<"users">; memberships: Id<"projects">[] };
type Handler = (ctx: TestCtx, args: unknown) => Promise<unknown>;
vi.mock("./lib/customFunctions", () => {
  const passThrough = (definition: { handler: Handler }) => ({ _handler: definition.handler });
  return { authedMutation: passThrough, authedQuery: passThrough };
});
vi.mock("./lib/auth", async original => ({
  ...await original<typeof import("./lib/auth")>(),
  getProjectIdsForUser: async (ctx: TestCtx) => ctx.memberships,
}));
vi.mock("./lib/accessGraph", () => ({ resolveEmployeeIdeDeviceIds: async () => ["device-1"] }));

type StoredRow = Record<string, unknown> & { _id: string; _creationTime: number };
async function fixture(role: Doc<"users">["role"] = "project_admin") {
  const tables = new Map<string, StoredRow[]>();
  const table = (name: string) => { const rows = tables.get(name) ?? []; tables.set(name, rows); return rows; };
  let serial = 0;
  const insert = async (name: string, value: Record<string, unknown>) => {
    const id = `${name}-${++serial}`;
    table(name).push({ ...value, _id: id, _creationTime: serial });
    return id;
  };
  // Convex reads return snapshots; patching must not mutate a previously read document.
  const get = async (id: string) => {
    const record = [...tables.values()].flat().find(item => item._id === id);
    return record ? { ...record } : null;
  };
  const query = (name: string) => {
    const filters: [string, unknown][] = [];
    const builder = { eq: (field: string, value: unknown) => { filters.push([field, value]); return builder; } };
    const selected = () => table(name).filter(item => filters.every(([key, value]) => item[key] === value));
    const chain = {
      withIndex: (_index: string, callback: (q: typeof builder) => unknown) => { callback(builder); return chain; },
      unique: async () => selected()[0] ?? null, first: async () => selected()[0] ?? null,
      collect: async () => selected(), take: async (limit: number) => selected().slice(0, limit),
      [Symbol.asyncIterator]: async function* () { yield* selected(); },
    };
    return chain;
  };
  const db = { insert, get, query, patch: async (id: string, value: Record<string, unknown>) => {
    const record = [...tables.values()].flat().find(item => item._id === id);
    if (!record) throw new Error("Missing fixture row");
    Object.assign(record, value);
  } };
  const userId = await insert("users", { name: "Yönetici", role }) as Id<"users">;
  const projectId = await insert("projects", { name: "Proje" }) as Id<"projects">;
  await insert("userProjects", { userId, projectId });
  const schedule = vi.fn();
  const ctx = { db, user: await get(userId), memberships: [projectId], scheduler: { runAfter: schedule } } as unknown as TestCtx;
  const invoke = (registered: unknown, args: unknown) => (registered as { _handler: Handler })._handler(ctx, args);
  const add = async (overrides: Partial<FunctionArgs<typeof api.employees.create>> = {}) =>
    await invoke(create, { projectId, firstName: "Ada", lastName: "Test", email: "", cardNumber: "", ...overrides }) as Id<"employees">;
  const jobs = () => schedule.mock.calls.map(call => ({ name: getFunctionName(call[1]), args: call[2] as unknown }));
  return { projectId, db, ctx, invoke, add, jobs, schedule };
}

describe("kartsız kişi → toplu kart atama", () => {
  it("birden çok kartsız kişiyi boşlukları temizleyerek kaydeder ve cihaz işi üretmez", async () => {
    const f = await fixture();
    const first = await f.add({ cardNumber: "  " });
    const second = await f.add();
    expect(first).not.toBe(second);
    expect(await f.db.get(first)).toMatchObject({ cardNumber: "", firstName: "Ada" });
    expect(await f.db.get(second)).toMatchObject({ cardNumber: "" });
    expect(f.jobs()).toEqual([]);
    await f.invoke(update, { employeeId: first, cardNumber: "  ", firstName: "Ayşe" });
    expect(await f.db.get(first)).toMatchObject({ cardNumber: "", firstName: "Ayşe" });
    expect(f.jobs()).toEqual([]);
  });

  it("ilk toplu kart atamasında her kişi için yalnız Hik ve IDE gönderimini oluşturur", async () => {
    const f = await fixture();
    const first = await f.add();
    const second = await f.add();
    expect(await f.invoke(assignCards, { assignments: [{ employeeId: first, cardNumber: "00123" }, { employeeId: second, cardNumber: "00456" }] })).toMatchObject([{ status: "assigned" }, { status: "assigned" }]);
    expect(await f.db.get(first)).toMatchObject({ cardNumber: "00123" });
    expect(await f.db.get(second)).toMatchObject({ cardNumber: "00456" });
    expect(f.jobs()).toEqual([first, second].flatMap(employeeId => [
      { name: "actions/hikvisionSync:syncEmployeeToDevicesInternal", args: { employeeId } },
      { name: "actions/ideGatewayDevice:syncEmployeeToIdePanels", args: { employeeId } },
    ]));
  });

  it("ilk kart formdan atanırken de boş eski kimliği silmez", async () => {
    const f = await fixture();
    const employeeId = await f.add();
    await f.invoke(update, { employeeId, cardNumber: " 0008 " });
    expect(await f.db.get(employeeId)).toMatchObject({ cardNumber: "0008" });
    expect(f.jobs().map(job => job.name)).toEqual([
      "actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/ideGatewayDevice:syncEmployeeToIdePanels",
    ]);
  });

  it("kart atama yinelenen sayısal kartı reddeder, kartsız kaydı ve kuyruğu korur", async () => {
    const f = await fixture();
    await f.add({ cardNumber: "00123" });
    const employeeId = await f.add();
    f.schedule.mockClear();
    expect(await f.invoke(assignCards, { assignments: [{ employeeId, cardNumber: "123" }] })).toMatchObject([{ status: "error" }]);
    expect(await f.db.get(employeeId)).toMatchObject({ cardNumber: "" });
    expect(f.jobs()).toEqual([]);
    await expect(f.add({ cardNumber: "123" })).rejects.toThrow("başka bir kayıtta");
  });

  it("kart kaldırmayı reddeder, kart değişiminde eski kimlik temizliğini korur", async () => {
    const f = await fixture();
    const employeeId = await f.add({ cardNumber: "OLD" });
    f.schedule.mockClear();
    await expect(f.invoke(update, { employeeId, cardNumber: "  " })).rejects.toThrow("Kart numarası zorunludur");
    expect(await f.db.get(employeeId)).toMatchObject({ cardNumber: "OLD" });
    expect(f.jobs()).toEqual([]);
    await f.invoke(update, { employeeId, cardNumber: "NEW" });
    expect(f.jobs().map(job => job.name)).toEqual([
      "actions/ideGatewayDevice:deleteIdeUserFromPanels", "actions/hikvisionSync:deleteEmployeeFromDevicesInternal", "actions/ideGatewayDevice:syncEmployeeToIdePanels",
    ]);
    expect(f.jobs()[0].args).toMatchObject({ cardNumber: "OLD" });
    expect(f.jobs()[1].args).toMatchObject({ snapshot: { cardNumber: "OLD" }, syncAfter: true });
  });

  it("yetkisiz kullanıcı kartsız kayıt veya atama yapamaz", async () => {
    const f = await fixture("project_user");
    await expect(f.add()).rejects.toThrow("yetkiniz yok");
    const employeeId = await f.db.insert("employees", { projectId: f.projectId, firstName: "Ada", lastName: "Test", email: "", cardNumber: "" });
    await expect(f.invoke(assignCards, { assignments: [{ employeeId, cardNumber: "123" }] })).rejects.toThrow("yetkiniz yok");
    expect(f.jobs()).toEqual([]);
  });
});
