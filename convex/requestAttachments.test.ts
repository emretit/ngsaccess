import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx, ActionCtx } from "./_generated/server";
import type { SystemDataModel } from "convex/server";
import * as attachments from "./requestAttachments";
import { withdraw as withdrawLeave } from "./leaveRequests";
import { withdraw as withdrawCorrection } from "./attendanceCorrections";

vi.mock("./lib/customFunctions", () => {
  const pass = (definition: { handler: unknown }) => ({ _handler: definition.handler });
  return { authedMutation: pass, authedQuery: pass, employeeAuthedMutation: pass, employeeAuthedQuery: pass };
});
type Context = MutationCtx & { user: Doc<"users">; employee: Doc<"employees"> };
type Row = Record<string, unknown> & { _id: string; table: string; _creationTime: number };
// Fixtures intentionally include incomplete/malformed documents for authorization
// tests, while known fields retain the corresponding schema types.
type FixtureDoc<T extends TableNames | "_storage"> = Partial<T extends TableNames ? Doc<T> : SystemDataModel["_storage"]["document"]> & Row & { _id: Id<T>; table: T };
const handler = (fn: unknown) => (fn as { _handler: (ctx: Context, args: Record<string, unknown>) => Promise<unknown> })._handler;
const httpHandler = (fn: unknown) => (fn as { _handler: (ctx: ActionCtx, request: Request) => Promise<Response> })._handler;
function fixture() {
  const rows: Row[] = [];
  let next = 0;
  const insertRow = (table: string, value: Record<string, unknown>, id = `${table}-${++next}`): Row => {
    const row: Row = { ...value, table, _id: id, _creationTime: Date.now() };
    rows.push(row); return row;
  };
  const put = <T extends TableNames | "_storage">(table: T, value: Record<string, unknown>, id?: string): FixtureDoc<T> =>
    insertRow(table, value, id) as FixtureDoc<T>;
  const project = put("projects", {}, "project-1");
  const employee = put("employees", { projectId: project._id, firstName: "Ada", lastName: "Yılmaz", isActive: true }, "employee-1");
  const user = put("users", { role: "project_admin", verified: true }, "user-1");
  const session = put("employeeSessions", { employeeId: employee._id, token: "session-1", passwordVersion: 1, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
  put("employeeAuth", { employeeId: employee._id, passwordVersion: 1, passwordHash: "hashed" });
  put("userProjects", { userId: user._id, projectId: project._id, role: "admin" });
  const query = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    const index = {
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return index; },
      lte: (key: string, value: number) => { filters.push(row => typeof row[key] === "number" && row[key] <= value); return index; },
    };
    const matched = () => rows.filter(row => row.table === table && filters.every(test => test(row)));
    const chain = {
      withIndex: (_name: string, build: (q: typeof index) => unknown) => { build(index); return chain; },
      order: () => chain,
      take: async (n: number) => matched().slice(0, n),
      first: async () => matched()[0] ?? null,
      unique: async () => matched()[0] ?? null,
      paginate: async () => ({ page: matched().slice(0, 100), isDone: true, continueCursor: "" }),
    };
    return chain;
  };
  const remove = vi.fn(async (id: string) => { const i = rows.findIndex(row => row._id === id); if (i !== -1) rows.splice(i, 1); });
  const get = async (id: string) => rows.find(row => row._id === id) ?? null;
  const storageDelete = vi.fn(async () => undefined);
  const ctx = {
    user, employee,
    db: {
      query, get, system: { get },
      insert: async (table: string, value: Record<string, unknown>) => insertRow(table, value)._id,
      delete: remove,
      patch: async (id: string, patch: Record<string, unknown>) => { const row = await get(id); if (!row) throw new Error("missing"); Object.assign(row, patch); },
    },
    storage: { delete: storageDelete, generateUploadUrl: vi.fn(async () => "https://secret-upload.convex.cloud/upload") },
    scheduler: { runAfter: vi.fn() },
  } as unknown as Context;
  const request = (kind: "leave" | "correction" = "leave") => put(kind === "leave" ? "leaves" : "attendanceCorrections", {
    employeeId: employee._id, projectId: project._id, status: "pending", source: "employee",
  });
  const file = (parent?: Row, patch: Record<string, unknown> = {}) => {
    const storage = put("_storage", { contentType: "application/pdf", size: 12 });
    return put("requestAttachments", {
      employeeId: employee._id, projectId: project._id, sessionId: session._id,
      name: "rapor.pdf", contentType: "application/pdf", size: 12, storageId: storage._id,
      ...(parent ? { [parent.table === "leaves" ? "leaveId" : "correctionId"]: parent._id } : { expiresAt: Date.now() + 86_400_000 }),
      ...patch,
    });
  };
  return { ctx, rows, put, get, remove, employee, user, session, project, request, file, storageDelete };
}

beforeEach(() => vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site"));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("request attachment validation and upload ownership", () => {
  it.each([
    { kind: "stalled consumed uploads", age: 60_001, completed: false, blocked: false },
    { kind: "consumed uploads exactly at expiry", age: 60_000, completed: false, blocked: false },
    { kind: "in-flight consumed uploads", age: 1_000, completed: false, blocked: true },
    { kind: "completed pending files", age: 60_001, completed: true, blocked: true },
  ])("counts quota correctly for $kind", async ({ age, completed, blocked }) => {
    const f = fixture();
    for (let i = 0; i < 9; i++) {
      const slot = f.file();
      slot._creationTime = Date.now() - age;
      if (!completed) slot.storageId = undefined;
    }
    const result = handler(attachments.beginUpload)(f.ctx, { sessionToken: "session-1", name: "rapor.pdf", contentType: "application/pdf", size: 12 });
    if (blocked) await expect(result).rejects.toThrow("Bekleyen belge yükleme sınırına ulaşıldı");
    else await expect(result).resolves.toHaveProperty("attachmentId");
  });
  it.each([0, -1, 5 * 1024 * 1024 + 1, 0.5])("rejects invalid byte size %s", size => {
    expect(() => attachments.validateAttachmentMetadata("application/pdf", size)).toThrow();
  });
  it.each([undefined, "text/html", "image/svg+xml", "application/octet-stream"])("rejects unsupported storage MIME %s", type => {
    expect(() => attachments.validateAttachmentMetadata(type, 12)).toThrow();
  });
  it("accepts the exact 5 MiB boundary and checks actual file signatures", () => {
    attachments.validateAttachmentMetadata("application/pdf", 5 * 1024 * 1024);
    expect(attachments.matchesAttachmentSignature(new TextEncoder().encode("%PDF-test"), "application/pdf")).toBe(true);
    expect(attachments.matchesAttachmentSignature(new TextEncoder().encode("<html>"), "application/pdf")).toBe(false);
    expect(attachments.matchesAttachmentSignature(new Uint8Array([255, 216, 255]), "image/jpeg")).toBe(true);
    expect(attachments.matchesAttachmentSignature(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "image/png")).toBe(true);
    expect(attachments.matchesAttachmentSignature(new TextEncoder().encode("RIFF0000WEBP"), "image/webp")).toBe(true);
  });
  it("keeps the storage upload URL private, hashes the proxy ticket, and consumes upload once", async () => {
    const f = fixture();
    const result = await handler(attachments.beginUpload)(f.ctx, { sessionToken: "session-1", name: "rapor.pdf", contentType: "application/pdf", size: 12 }) as { uploadUrl: string; attachmentId: string };
    expect(result.uploadUrl).toMatch(/^https:\/\/test.convex.site\/request-attachments\?ticket=/);
    expect(JSON.stringify(result)).not.toContain("secret-upload");
    const token = new URL(result.uploadUrl).searchParams.get("ticket") ?? "";
    const tokenHash = await attachments.hashTicket(token);
    expect(await f.get(result.attachmentId)).toMatchObject({ uploadHash: tokenHash });
    expect(tokenHash).not.toBe(token);
    expect(await handler(attachments.consumeUpload)(f.ctx, { tokenHash })).toMatchObject({ _id: result.attachmentId });
    expect(await handler(attachments.consumeUpload)(f.ctx, { tokenHash })).toBeNull();
  });
  it("validates storage metadata independently from the supplied MIME and size", async () => {
    const f = fixture(); const slot = f.file(); slot.storageId = undefined;
    const storage = f.put("_storage", { contentType: "text/html", size: 12 });
    await expect(handler(attachments.completeUpload)(f.ctx, { attachmentId: slot._id, storageId: storage._id })).rejects.toThrow();
    storage.contentType = "application/pdf"; storage.size = 13;
    await expect(handler(attachments.completeUpload)(f.ctx, { attachmentId: slot._id, storageId: storage._id })).rejects.toThrow();
    storage.size = 12;
    await handler(attachments.completeUpload)(f.ctx, { attachmentId: slot._id, storageId: storage._id });
    expect(slot.storageId).toBe(storage._id);
  });
  it("expires upload tickets after 60 seconds, before the abandoned-slot cleanup deadline", async () => {
    const f = fixture();
    const result = await handler(attachments.beginUpload)(f.ctx, { sessionToken: "session-1", name: "rapor.pdf", contentType: "application/pdf", size: 12 }) as { uploadUrl: string; attachmentId: string };
    const slot = await f.get(result.attachmentId);
    if (!slot) throw new Error("missing slot");
    slot._creationTime = Date.now() - 60_001;
    const tokenHash = await attachments.hashTicket(new URL(result.uploadUrl).searchParams.get("ticket") ?? "");
    expect(await handler(attachments.consumeUpload)(f.ctx, { tokenHash })).toBeNull();
  });
  it("uploads valid bytes server-side and binds the returned storage ID only after metadata validation", async () => {
    const f = fixture();
    const slot = await handler(attachments.beginUpload)(f.ctx, { sessionToken: "session-1", name: "rapor.pdf", contentType: "application/pdf", size: 9 }) as { uploadUrl: string; attachmentId: string };
    const storage = f.put("_storage", { contentType: "application/pdf", size: 9 });
    const fetchUpload = vi.fn(async () => new Response(JSON.stringify({ storageId: storage._id })));
    vi.stubGlobal("fetch", fetchUpload);
    let calls = 0;
    const ctx = {
      runMutation: (_ref: unknown, args: Record<string, unknown>) => handler(calls++ === 0 ? attachments.consumeUpload : attachments.completeUpload)(f.ctx, args),
      storage: { delete: f.storageDelete },
    } as unknown as ActionCtx;
    const response = await httpHandler(attachments.upload)(ctx, new Request(slot.uploadUrl, { method: "POST", body: "%PDF-test" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ attachmentId: slot.attachmentId });
    expect(await f.get(slot.attachmentId)).toMatchObject({ storageId: storage._id });
    expect(fetchUpload).toHaveBeenCalledWith("https://secret-upload.convex.cloud/upload", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/pdf" } }));
  });
  it.each(["<html>bad", "%PDF-too-long"])("rejects invalid content or size before reaching storage: %s", async body => {
    const f = fixture();
    const slot = await handler(attachments.beginUpload)(f.ctx, { sessionToken: "session-1", name: "rapor.pdf", contentType: "application/pdf", size: 9 }) as { uploadUrl: string };
    const fetchUpload = vi.fn(); vi.stubGlobal("fetch", fetchUpload);
    const ctx = { runMutation: (_ref: unknown, args: Record<string, unknown>) => handler(attachments.consumeUpload)(f.ctx, args) } as unknown as ActionCtx;
    const response = await httpHandler(attachments.upload)(ctx, new Request(slot.uploadUrl, { method: "POST", body }));
    expect([413, 415]).toContain(response.status);
    expect(fetchUpload).not.toHaveBeenCalled();
  });
  it("deletes uploaded bytes if completion fails rather than leaking an untracked file", async () => {
    const f = fixture();
    const slot = await handler(attachments.beginUpload)(f.ctx, { sessionToken: "session-1", name: "rapor.pdf", contentType: "application/pdf", size: 9 }) as { uploadUrl: string };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ storageId: "storage-rejected" }))));
    let calls = 0;
    const ctx = {
      runMutation: (_ref: unknown, args: Record<string, unknown>) => {
        if (calls++ === 0) return handler(attachments.consumeUpload)(f.ctx, args);
        throw new Error("invalid metadata");
      },
      storage: { delete: f.storageDelete },
    } as unknown as ActionCtx;
    expect((await httpHandler(attachments.upload)(ctx, new Request(slot.uploadUrl, { method: "POST", body: "%PDF-test" }))).status).toBe(400);
    expect(f.storageDelete).toHaveBeenCalledWith("storage-rejected");
  });
  it("cannot bind another employee/project's file, rebind, or exceed 3 distinct files", async () => {
    const f = fixture(); const file = f.file(); const request = { leaveId: "leave-1" as Id<"leaves"> };
    const employee = f.ctx.employee;
    for (const patch of [{ employeeId: "employee-2" }, { employeeId: employee._id, projectId: "project-2" }]) {
      Object.assign(file, patch);
      await expect(attachments.bindRequestAttachments(f.ctx, employee, [file._id as Id<"requestAttachments">], request)).rejects.toThrow();
    }
    Object.assign(file, { employeeId: employee._id, projectId: employee.projectId });
    const id = file._id as Id<"requestAttachments">;
    await expect(attachments.bindRequestAttachments(f.ctx, employee, [id, id], request)).rejects.toThrow("3");
    await expect(attachments.bindRequestAttachments(f.ctx, employee, [id, id, id, id], request)).rejects.toThrow("3");
    await attachments.bindRequestAttachments(f.ctx, employee, [id], request);
    expect(file.expiresAt).toBeUndefined();
    await expect(attachments.bindRequestAttachments(f.ctx, employee, [id], request)).rejects.toThrow();
  });
  it("rejects expired/unready uploads and discard only accepts the owner's unbound files", async () => {
    const f = fixture(); const file = f.file(undefined, { expiresAt: Date.now() - 1 });
    await expect(attachments.bindRequestAttachments(f.ctx, f.ctx.employee, [file._id as Id<"requestAttachments">], { leaveId: "leave" as Id<"leaves"> })).rejects.toThrow();
    file.employeeId = "other" as Id<"employees">;
    await expect(handler(attachments.discard)(f.ctx, { sessionToken: "session-1", attachmentId: file._id })).rejects.toThrow();
    file.employeeId = f.employee._id;
    await handler(attachments.discard)(f.ctx, { sessionToken: "session-1", attachmentId: file._id });
    expect(f.storageDelete).toHaveBeenCalledWith(file.storageId);
    expect(await f.get(file._id)).toBeNull();
  });
});

describe("IDOR, one-use download tickets and revocation", () => {
  it.each(["leave", "correction"] as const)("only the owner or an authorized project approver can access a %s attachment", async kind => {
    const f = fixture(); const file = f.file(f.request(kind));
    const args = { sessionToken: "session-1", attachmentId: file._id };
    expect(await handler(attachments.downloadMine)(f.ctx, args)).toHaveProperty("url");
    expect(await handler(attachments.download)(f.ctx, { attachmentId: file._id })).toHaveProperty("url");
    file.employeeId = "employee-2" as Id<"employees">;
    await expect(handler(attachments.downloadMine)(f.ctx, args)).rejects.toThrow();
    file.employeeId = f.employee._id; file.projectId = "project-2" as Id<"projects">;
    await expect(handler(attachments.downloadMine)(f.ctx, args)).rejects.toThrow();
    await expect(handler(attachments.download)(f.ctx, { attachmentId: file._id })).rejects.toThrow();
    file.projectId = f.project._id;
    const membership = f.rows.find(row => row.table === "userProjects");
    if (!membership) throw new Error("missing membership");
    membership.projectId = "project-2";
    await expect(handler(attachments.download)(f.ctx, { attachmentId: file._id })).rejects.toThrow();
    membership.projectId = f.project._id; membership.role = "viewer";
    await expect(handler(attachments.download)(f.ctx, { attachmentId: file._id })).rejects.toThrow();
  });
  it("only stores the hash, expires after 60 seconds, and consumes each ticket once", async () => {
    const f = fixture(); const file = f.file(f.request()); const start = Date.now();
    const result = await handler(attachments.download)(f.ctx, { attachmentId: file._id }) as { url: string; expiresAt: number };
    expect(result.expiresAt - start).toBeLessThanOrEqual(60_100);
    const token = new URL(result.url).searchParams.get("ticket") ?? "";
    const tokenHash = await attachments.hashTicket(token);
    const ticket = f.rows.find(row => row.table === "requestAttachmentTickets");
    expect(ticket?.tokenHash).toBe(tokenHash);
    expect(JSON.stringify(ticket)).not.toContain(token);
    expect(await handler(attachments.consumeDownload)(f.ctx, { tokenHash })).toMatchObject({ storageId: file.storageId });
    expect(await handler(attachments.consumeDownload)(f.ctx, { tokenHash })).toBeNull();
    const expired = f.put("requestAttachmentTickets", { tokenHash: "expired", expiresAt: Date.now() - 1, attachmentId: file._id, userId: f.user._id });
    expect(await handler(attachments.consumeDownload)(f.ctx, { tokenHash: "expired" })).toBeNull();
    expect(await f.get(expired._id)).toBeNull();
  });
  it.each(["permission", "disabled", "moved", "deleted", "withdrawn", "session"])("rechecks %s at consumption time", async change => {
    const f = fixture(); const request = f.request("correction"); const file = f.file(request);
    const mobile = change === "session";
    const result = await handler(mobile ? attachments.downloadMine : attachments.download)(f.ctx, { attachmentId: file._id, ...(mobile ? { sessionToken: "session-1" } : {}) }) as { url: string };
    if (change === "permission") { const m = f.rows.find(row => row.table === "userProjects"); if (m) m.role = "viewer"; }
    if (change === "disabled") f.user.disabledAt = Date.now();
    if (change === "moved") f.employee.projectId = "project-2" as Id<"projects">;
    if (change === "deleted") await f.remove(request._id);
    if (change === "withdrawn") request.status = "withdrawn";
    if (change === "session") await f.remove(f.session._id);
    const tokenHash = await attachments.hashTicket(new URL(result.url).searchParams.get("ticket") ?? "");
    expect(await handler(attachments.consumeDownload)(f.ctx, { tokenHash })).toBeNull();
    expect(await handler(attachments.consumeDownload)(f.ctx, { tokenHash })).toBeNull();
  });
  it("serves bytes with private no-store and attachment headers, never a storage URL", async () => {
    const f = fixture(); const file = f.file(f.request());
    const result = await handler(attachments.download)(f.ctx, { attachmentId: file._id }) as { url: string };
    const ctx = {
      runMutation: (_ref: unknown, args: Record<string, unknown>) => handler(attachments.consumeDownload)(f.ctx, args),
      storage: { get: vi.fn(async () => new Blob(["%PDF-private"], { type: "application/pdf" })), getUrl: vi.fn() },
    };
    const response = await httpHandler(attachments.serve)(ctx as unknown as ActionCtx, new Request(result.url));
    expect(await response.text()).toBe("%PDF-private");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toContain("attachment;");
    expect(response.headers.get("Location")).toBeNull();
    expect(ctx.storage.getUrl).not.toHaveBeenCalled();
    expect((await httpHandler(attachments.serve)(ctx as unknown as ActionCtx, new Request(result.url))).status).toBe(404);
  });
});

describe("withdrawal and abandoned file deletion", () => {
  it.each(["leave", "correction"] as const)("deletes stored bytes immediately when a %s request is withdrawn", async kind => {
    const f = fixture(); const parent = f.request(kind); const file = f.file(parent);
    await handler(kind === "leave" ? withdrawLeave : withdrawCorrection)(f.ctx, kind === "leave" ? { leaveId: parent._id } : { id: parent._id });
    expect(f.storageDelete).toHaveBeenCalledWith(file.storageId);
    expect(await f.get(file._id)).toBeNull();
    if (kind === "leave") expect(await f.get(parent._id)).toBeNull();
    else expect(parent.status).toBe("withdrawn");
  });
  it("daily cleanup deletes abandoned uploads, orphaned request files and expired tickets", async () => {
    const f = fixture(); const valid = f.file(f.request());
    const abandoned = f.file(undefined, { expiresAt: Date.now() - 1 });
    const orphan = f.file(undefined, { leaveId: "deleted-leave", expiresAt: undefined });
    const ticket = f.put("requestAttachmentTickets", { expiresAt: Date.now() - 1, tokenHash: "expired", attachmentId: orphan._id });
    await handler(attachments.cleanup)(f.ctx, {});
    expect(await f.get(valid._id)).not.toBeNull();
    for (const row of [abandoned, orphan, ticket]) expect(await f.get(row._id)).toBeNull();
    expect(f.storageDelete).toHaveBeenCalledTimes(2);
  });
});

// Fake transports test handler behavior; dashboardSummary.test.ts covers real DB hooks.
vi.mock("./lib/dashboardSummary", async importOriginal => ({
  ...await importOriginal<typeof import("./lib/dashboardSummary")>(),
  withDashboardSummary: <T,>(ctx: T) => ctx,
}));
