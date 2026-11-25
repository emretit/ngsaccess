import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction, internalMutation, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authedMutation } from "./lib/customFunctions";
import { getCurrentEmployee } from "./lib/employeeAuth";
import { requirePermission } from "./lib/permissions";
import { accessBlockReason } from "./lib/accountAccess";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const DAY = 86_400_000;
const MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const denied = () => new ConvexError("Belge bulunamadı veya erişim yetkiniz yok");
const idArg = { attachmentId: v.id("requestAttachments") };

export async function hashTicket(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

function endpoint(ticket: string): string {
  const origin = process.env.CONVEX_SITE_URL;
  if (!origin) throw new ConvexError("Belge servisi yapılandırılmamış");
  return `${origin}/request-attachments?ticket=${encodeURIComponent(ticket)}`;
}

export function validateAttachmentMetadata(contentType: string | undefined, size: number) {
  if (!contentType || !MIME_TYPES.has(contentType) || !Number.isInteger(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) {
    throw new ConvexError("Belge PDF, JPEG, PNG veya WebP olmalı ve 5 MB'ı aşmamalı");
  }
}

export function matchesAttachmentSignature(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  return contentType === "image/webp" && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}

async function employeeSession(ctx: MutationCtx, token: string) {
  const employee = await getCurrentEmployee(ctx, token);
  const session = await ctx.db.query("employeeSessions").withIndex("by_token", q => q.eq("token", token)).first();
  if (!session || !employee.projectId) throw denied();
  return { employee, session, projectId: employee.projectId };
}

// The storage upload URL stays server-side. Only this proxy can bind a storage ID
// to a slot, so a caller cannot claim another employee's (or another feature's) file.
export const beginUpload = mutation({
  args: { sessionToken: v.string(), name: v.string(), contentType: v.string(), size: v.number() },
  handler: async (ctx, args) => {
    const { employee, session, projectId } = await employeeSession(ctx, args.sessionToken);
    validateAttachmentMetadata(args.contentType, args.size);
    const name = args.name.trim();
    if (!name || name.length > 180 || /[/\\]/.test(name) || Array.from(name).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) throw new ConvexError("Geçersiz belge adı");
    const uploads = await ctx.db.query("requestAttachments").withIndex("by_employeeId", q => q.eq("employeeId", employee._id)).order("desc").take(101);
    const now = Date.now();
    const pendingCount = uploads.filter(row => row.expiresAt !== undefined && row.expiresAt > now
      // Consumed tickets without a completed file stop occupying a slot after 60s.
      && (row.storageId !== undefined || row.uploadUrl !== undefined || row._creationTime + 60_000 > now)).length;
    if (pendingCount >= 9) throw new ConvexError("Bekleyen belge yükleme sınırına ulaşıldı");
    const ticket = crypto.randomUUID();
    const url = endpoint(ticket);
    const attachmentId = await ctx.db.insert("requestAttachments", {
      employeeId: employee._id, projectId, sessionId: session._id, name,
      contentType: args.contentType, size: args.size,
      expiresAt: Date.now() + DAY, uploadHash: await hashTicket(ticket),
      uploadUrl: await ctx.storage.generateUploadUrl(),
    });
    return { attachmentId, uploadUrl: url };
  },
});

export const consumeUpload = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const slot = await ctx.db.query("requestAttachments").withIndex("by_uploadHash", q => q.eq("uploadHash", tokenHash)).unique();
    if (!slot || !slot.uploadUrl || !slot.expiresAt || slot.expiresAt <= Date.now() || slot._creationTime + 60_000 <= Date.now()) return null;
    const session = await ctx.db.get(slot.sessionId);
    if (!session) return null;
    const employee = await getCurrentEmployee(ctx, session.token);
    if (employee._id !== slot.employeeId || employee.projectId !== slot.projectId) return null;
    const upload = { _id: slot._id, uploadUrl: slot.uploadUrl, size: slot.size, contentType: slot.contentType };
    await ctx.db.patch(slot._id, { uploadHash: undefined, uploadUrl: undefined });
    return upload;
  },
});

export const completeUpload = internalMutation({
  args: { ...idArg, storageId: v.id("_storage") },
  handler: async (ctx, { attachmentId, storageId }) => {
    const slot = await ctx.db.get(attachmentId);
    const meta = await ctx.db.system.get(storageId);
    if (!slot || slot.storageId || !slot.expiresAt || slot.expiresAt <= Date.now() || !meta) throw denied();
    validateAttachmentMetadata(meta.contentType, meta.size);
    if (meta.size !== slot.size || meta.contentType !== slot.contentType) throw new ConvexError("Belge bilgileri yüklenen dosyayla eşleşmiyor");
    const session = await ctx.db.get(slot.sessionId);
    if (!session) throw denied();
    const employee = await getCurrentEmployee(ctx, session.token);
    if (employee._id !== slot.employeeId || employee.projectId !== slot.projectId) throw denied();
    await ctx.db.patch(attachmentId, { storageId });
    return null;
  },
});

export async function bindRequestAttachments(
  ctx: MutationCtx, employee: Doc<"employees">, ids: Id<"requestAttachments">[] | undefined,
  request: { leaveId: Id<"leaves"> } | { correctionId: Id<"attendanceCorrections"> },
) {
  if (!ids?.length) return;
  if (ids.length > 3 || new Set(ids).size !== ids.length) throw new ConvexError("En fazla 3 farklı belge eklenebilir");
  for (const id of ids) {
    const row = await ctx.db.get(id);
    if (!row || row.employeeId !== employee._id || row.projectId !== employee.projectId || !row.storageId || row.leaveId || row.correctionId || !row.expiresAt || row.expiresAt <= Date.now()) throw denied();
    const meta = await ctx.db.system.get(row.storageId);
    if (!meta) throw denied();
    validateAttachmentMetadata(meta.contentType, meta.size);
    await ctx.db.patch(id, { ...request, expiresAt: undefined });
  }
}

type DbCtx = QueryCtx | MutationCtx;
export async function attachmentsFor(ctx: DbCtx, request: { leaveId: Id<"leaves"> } | { correctionId: Id<"attendanceCorrections"> }) {
  const rows = "leaveId" in request
    ? await ctx.db.query("requestAttachments").withIndex("by_leaveId", q => q.eq("leaveId", request.leaveId)).take(3)
    : await ctx.db.query("requestAttachments").withIndex("by_correctionId", q => q.eq("correctionId", request.correctionId)).take(3);
  return rows.map(row => ({ _id: row._id, name: row.name, contentType: row.contentType, size: row.size }));
}

export async function deleteRequestAttachments(ctx: MutationCtx, request: { leaveId: Id<"leaves"> } | { correctionId: Id<"attendanceCorrections"> }) {
  for (const attachment of await attachmentsFor(ctx, request)) await deleteAttachment(ctx, attachment._id);
}
async function deleteAttachment(ctx: MutationCtx, id: Id<"requestAttachments">) {
  const row = await ctx.db.get(id);
  if (row?.storageId) await ctx.storage.delete(row.storageId);
  if (row) await ctx.db.delete(id);
}

export const discard = mutation({
  args: { sessionToken: v.string(), ...idArg },
  handler: async (ctx, { sessionToken, attachmentId }) => {
    const { employee } = await employeeSession(ctx, sessionToken);
    const row = await ctx.db.get(attachmentId);
    if (!row) return null;
    if (row.employeeId !== employee._id || row.projectId !== employee.projectId || row.leaveId || row.correctionId) throw denied();
    await deleteAttachment(ctx, attachmentId);
    return null;
  },
});

async function accessibleRequest(ctx: DbCtx, row: Doc<"requestAttachments">) {
  const request = row.leaveId ? await ctx.db.get(row.leaveId) : row.correctionId ? await ctx.db.get(row.correctionId) : null;
  const employee = await ctx.db.get(row.employeeId);
  if (!row.storageId || !request || request.status === "withdrawn" || request.employeeId !== row.employeeId || request.projectId !== row.projectId || employee?.projectId !== row.projectId || !await ctx.db.get(row.projectId)) throw denied();
}
async function authorizeAdmin(ctx: DbCtx, row: Doc<"requestAttachments">, user: Doc<"users">) {
  if (user.verified === false || accessBlockReason(user, Date.now())) throw denied();
  await accessibleRequest(ctx, row);
  await requirePermission(ctx, user, row.projectId, "attendance.approve");
}
async function authorizeEmployee(ctx: DbCtx, row: Doc<"requestAttachments">, sessionId: Id<"employeeSessions">) {
  const session = await ctx.db.get(sessionId);
  if (!session) throw denied();
  const employee = await getCurrentEmployee(ctx, session.token);
  if (employee._id !== row.employeeId || employee.projectId !== row.projectId) throw denied();
  await accessibleRequest(ctx, row);
}
async function createTicket(ctx: MutationCtx, attachmentId: Id<"requestAttachments">, principal: { userId: Id<"users"> } | { sessionId: Id<"employeeSessions"> }) {
  const ticket = crypto.randomUUID();
  const expiresAt = Date.now() + 60_000;
  const url = endpoint(ticket);
  await ctx.db.insert("requestAttachmentTickets", { attachmentId, tokenHash: await hashTicket(ticket), expiresAt, ...principal });
  return { url, expiresAt };
}
export const download = authedMutation({
  args: idArg,
  handler: async (ctx, { attachmentId }) => {
    const row = await ctx.db.get(attachmentId);
    if (!row) throw denied();
    await authorizeAdmin(ctx, row, ctx.user);
    return createTicket(ctx, attachmentId, { userId: ctx.user._id });
  },
});
export const downloadMine = mutation({
  args: { sessionToken: v.string(), ...idArg },
  handler: async (ctx, { attachmentId, sessionToken }) => {
    const { session } = await employeeSession(ctx, sessionToken);
    const row = await ctx.db.get(attachmentId);
    if (!row) throw denied();
    await authorizeEmployee(ctx, row, session._id);
    return createTicket(ctx, attachmentId, { sessionId: session._id });
  },
});
export const consumeDownload = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const ticket = await ctx.db.query("requestAttachmentTickets").withIndex("by_tokenHash", q => q.eq("tokenHash", tokenHash)).unique();
    if (!ticket) return null;
    await ctx.db.delete(ticket._id);
    if (ticket.expiresAt <= Date.now()) return null;
    const row = await ctx.db.get(ticket.attachmentId);
    if (!row) return null;
    try {
      if (ticket.userId) {
        const user = await ctx.db.get(ticket.userId);
        if (!user) return null;
        await authorizeAdmin(ctx, row, user);
      } else if (ticket.sessionId) await authorizeEmployee(ctx, row, ticket.sessionId);
      else return null;
    } catch { return null; }
    return { storageId: row.storageId, name: row.name, contentType: row.contentType };
  },
});

// Both routes always serve bytes, never redirect to storage.getUrl().
export const serve = httpAction(async (ctx, request) => {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
  const ticket = new URL(request.url).searchParams.get("ticket");
  if (!ticket || !/^[a-f0-9-]{36}$/.test(ticket)) return new Response(null, { status: 404, headers });
  try {
    const row = await ctx.runMutation(internal.requestAttachments.consumeDownload, { tokenHash: await hashTicket(ticket) });
    if (!row?.storageId) return new Response(null, { status: 404, headers });
    const blob = await ctx.storage.get(row.storageId);
    if (!blob) return new Response(null, { status: 404, headers });
    return new Response(blob, { headers: { ...headers, "Content-Type": row.contentType, "Content-Disposition": `attachment; filename="belge"; filename*=UTF-8''${encodeURIComponent(row.name).replace(/'/g, "%27")}` } });
  } catch { return new Response(null, { status: 404, headers }); }
});

export const upload = httpAction(async (ctx, request) => {
  const headers = { "Cache-Control": "private, no-store" };
  const ticket = new URL(request.url).searchParams.get("ticket");
  if (!ticket || !/^[a-f0-9-]{36}$/.test(ticket)) return new Response(null, { status: 404, headers });
  let storageId: Id<"_storage"> | undefined;
  try {
    const slot = await ctx.runMutation(internal.requestAttachments.consumeUpload, { tokenHash: await hashTicket(ticket) });
    if (!slot?.uploadUrl) return new Response(null, { status: 404, headers });
    const chunks: Uint8Array[] = [];
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400, headers });
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > MAX_ATTACHMENT_BYTES || size > slot.size) { await reader.cancel(); return new Response(null, { status: 413, headers }); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (size !== slot.size || !matchesAttachmentSignature(bytes, slot.contentType)) return new Response(null, { status: 415, headers });
    const uploaded = await fetch(slot.uploadUrl, { method: "POST", headers: { "Content-Type": slot.contentType }, body: bytes });
    if (!uploaded.ok) throw new Error("Upload failed");
    const result: unknown = await uploaded.json();
    if (!result || typeof result !== "object" || !("storageId" in result) || typeof result.storageId !== "string") throw new Error("Invalid upload response");
    storageId = result.storageId as Id<"_storage">;
    await ctx.runMutation(internal.requestAttachments.completeUpload, { attachmentId: slot._id, storageId });
    return new Response(JSON.stringify({ attachmentId: slot._id }), { headers: { ...headers, "Content-Type": "application/json" } });
  } catch {
    if (storageId) await ctx.storage.delete(storageId);
    return new Response(null, { status: 400, headers });
  }
});

export const cleanup = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const tickets = await ctx.db.query("requestAttachmentTickets").withIndex("by_expiresAt", q => q.lte("expiresAt", Date.now())).take(200);
    for (const ticket of tickets) await ctx.db.delete(ticket._id);
    const page = await ctx.db.query("requestAttachments").paginate({ cursor: cursor ?? null, numItems: 100 });
    for (const row of page.page) {
      const request = row.leaveId ? await ctx.db.get(row.leaveId) : row.correctionId ? await ctx.db.get(row.correctionId) : null;
      const ownerMissing = !await ctx.db.get(row.employeeId) || !await ctx.db.get(row.projectId);
      if (ownerMissing || (row.expiresAt !== undefined && row.expiresAt <= Date.now()) || ((row.leaveId || row.correctionId) && (!request || request.status === "withdrawn"))) await deleteAttachment(ctx, row._id);
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.requestAttachments.cleanup, { cursor: page.continueCursor });
    else if (tickets.length === 200) await ctx.scheduler.runAfter(0, internal.requestAttachments.cleanup, {});
    return null;
  },
});
