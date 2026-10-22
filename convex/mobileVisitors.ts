import { v } from "convex/values";
import { stream } from "convex-helpers/server/stream";
import schema from "./schema";
import { paginationOptsValidator } from "convex/server";
import { visitorStatus } from "./lib/visitorStatus";
import { employeeAuthedMutation, employeeAuthedQuery } from "./lib/customFunctions";
import { decodeVisitorCursor, encodeVisitorCursor, mobileVisitorMatches, normalizeVisitorSearch, MOBILE_VISITOR_SUMMARY_LIMIT, editableInvitation, hostProject, invitationDetail, invitationRow, normalizedInvitation, ownInvitation, projectNotice, visitorError } from "./lib/mobileVisitors";

const fields = {
  firstName: v.string(), lastName: v.string(), visitorPhone: v.optional(v.union(v.string(), v.null())),
  notes: v.optional(v.union(v.string(), v.null())), visitPurpose: v.string(),
  visitStart: v.string(), visitEnd: v.string(),
};

export const notice = employeeAuthedQuery({
  args: {},
  handler: async ctx => projectNotice(ctx, hostProject(ctx.employee)),
});

const statusValidator = v.union(v.literal("active"), v.literal("checkedOut"), v.literal("expired"), v.literal("preRegistered"));

/** Minimal recovery receipt; a null result does not prove a request never ran. */
export const getCreateReceipt = employeeAuthedQuery({
  args: { requestId: v.string() },
  returns: v.union(v.null(), v.object({ id: v.id("employees"), status: statusValidator })),
  handler: async (ctx, args) => {
    const projectId = hostProject(ctx.employee);
    // Match create's UUID contract exactly, without accepting unbounded keys.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(args.requestId)) throw visitorError("VISITOR_INVALID");
    const previous = await ctx.db.query("employees")
      .withIndex("by_host_mobile_visitor_request", q => q.eq("hostEmployeeId", ctx.employee._id).eq("mobileVisitorRequestId", args.requestId)).unique();
    if (!previous || !previous.isVisitor || previous.hostEmployeeId !== ctx.employee._id || previous.projectId !== projectId) return null;
    return { id: previous._id, status: visitorStatus(previous, Date.now()) };
  },
});

export const listPage = employeeAuthedQuery({
  args: { paginationOpts: paginationOptsValidator, search: v.optional(v.string()), status: v.optional(statusValidator) },
  handler: async (ctx, args) => {
    const projectId = hostProject(ctx.employee);
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 30) throw visitorError("VISITOR_INVALID");
    const search = normalizeVisitorSearch(args.search);
    const bound = decodeVisitorCursor(args.paginationOpts.cursor, ctx.employee, search, args.status);
    const result = await stream(ctx.db, schema).query("employees")
      .withIndex("by_project_host_visitor", q => q.eq("projectId", projectId).eq("hostEmployeeId", ctx.employee._id).eq("isVisitor", true))
      .order("desc").filterWith(async row => mobileVisitorMatches(row, search, args.status, bound.evaluatedAt))
      .paginate({ numItems: args.paginationOpts.numItems, cursor: bound.cursor, maximumRowsRead: 200, maximumBytesRead: 128 * 1024 });
    return { ...result, page: result.page.map(row => invitationRow(row, bound.evaluatedAt)),
      continueCursor: encodeVisitorCursor(result.continueCursor, ctx.employee, search, args.status, bound.evaluatedAt),
      scanLimited: result.pageStatus === "SplitRequired", evaluatedAt: bound.evaluatedAt };
  },
});

/** A bounded independent summary, never inferred from the current visible page. */
export const summary = employeeAuthedQuery({
  args: {},
  handler: async ctx => {
    const projectId = hostProject(ctx.employee);
    const result = await stream(ctx.db, schema).query("employees").withIndex("by_project_host_visitor", q =>
      q.eq("projectId", projectId).eq("hostEmployeeId", ctx.employee._id).eq("isVisitor", true))
      .paginate({ numItems: MOBILE_VISITOR_SUMMARY_LIMIT + 1, cursor: null, maximumRowsRead: MOBILE_VISITOR_SUMMARY_LIMIT + 1, maximumBytesRead: 512 * 1024 });
    const rows = result.page;
    const counts = { active: 0, checkedOut: 0, expired: 0, preRegistered: 0 };
    let total = 0;
    const evaluatedAt = Date.now();
    for (const row of rows.slice(0, MOBILE_VISITOR_SUMMARY_LIMIT)) {
      if (!row.mobileVisitorRequestId) continue;
      counts[visitorStatus(row, evaluatedAt)]++;
      total++;
    }
    return { total, counts, overflow: !result.isDone || rows.length > MOBILE_VISITOR_SUMMARY_LIMIT, scanned: Math.min(rows.length, MOBILE_VISITOR_SUMMARY_LIMIT), limit: MOBILE_VISITOR_SUMMARY_LIMIT, evaluatedAt };
  },
});

export const detail = employeeAuthedQuery({
  args: { visitorId: v.id("employees") },
  handler: async (ctx, args) => invitationDetail(ctx, await ownInvitation(ctx, ctx.employee, args.visitorId)),
});

/** Creates no group membership, scheduler job, real card, or active access. */
export const create = employeeAuthedMutation({
  args: { ...fields, requestId: v.string(), noticeVersion: v.optional(v.string()), noticeReviewed: v.boolean() },
  handler: async (ctx, args) => {
    const projectId = hostProject(ctx.employee);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(args.requestId)) throw visitorError("VISITOR_INVALID");
    // Canonical intent includes notice acknowledgement; a lost response can be
    // retried after expiry or a policy change without creating a second visitor.
    const intent = [args.firstName.trim(), args.lastName.trim(), args.visitorPhone?.trim() || null,
      args.visitPurpose.trim(), args.visitStart, args.visitEnd, args.noticeVersion ?? null, args.noticeReviewed];
    // Preserve fingerprints of pre-notes clients when no note was supplied.
    const note = args.notes?.trim() || null;
    if (note !== null) intent.push(note);
    const fingerprint = JSON.stringify(intent);
    const previous = await ctx.db.query("employees")
      .withIndex("by_host_mobile_visitor_request", q => q.eq("hostEmployeeId", ctx.employee._id).eq("mobileVisitorRequestId", args.requestId)).unique();
    if (previous) {
      if (previous.projectId !== projectId || previous.mobileVisitorRequestFingerprint !== fingerprint) throw visitorError("REQUEST_CONFLICT");
      return { id: previous._id, status: invitationRow(previous).status, replayed: true };
    }
    const data = normalizedInvitation(args);
    const notice = await projectNotice(ctx, projectId);
    if ((notice.version && (!args.noticeReviewed || notice.version !== args.noticeVersion)) ||
        (!notice.version && args.noticeVersion)) throw visitorError("VISITOR_NOTICE_CHANGED");
    const now = new Date().toISOString();
    const id = await ctx.db.insert("employees", {
      ...data, projectId, hostEmployeeId: ctx.employee._id, isVisitor: true,
      isActive: false, visitorStatus: "preRegistered", cardNumber: `PRE:${crypto.randomUUID()}`,
      email: `preregistered-${crypto.randomUUID()}@ngsaccess.local`,
      mobileVisitorRequestId: args.requestId, mobileVisitorRequestFingerprint: fingerprint,
      // This records the host's notice review, not visitor consent on their behalf.
      ...(notice.url && notice.version ? { mobileVisitorNoticeUrl: notice.url, mobileVisitorNoticeVersion: notice.version } : {}),
      createdAt: now, updatedAt: now,
    });
    return { id, status: "preRegistered" as const, replayed: false };
  },
});

export const update = employeeAuthedMutation({
  args: { ...fields, visitorId: v.id("employees") },
  handler: async (ctx, args) => {
    const visitor = await ownInvitation(ctx, ctx.employee, args.visitorId);
    if (!editableInvitation(visitor)) throw visitorError("VISITOR_LOCKED");
    const { visitorPhone, notes, ...requiredData } = normalizedInvitation(args);
    await ctx.db.patch(visitor._id, { ...requiredData,
      ...(args.visitorPhone !== undefined ? { visitorPhone } : {}),
      ...(args.notes !== undefined ? { notes } : {}), updatedAt: new Date().toISOString() });
    return { id: visitor._id };
  },
});

export const cancel = employeeAuthedMutation({
  args: { visitorId: v.id("employees") },
  handler: async (ctx, args) => {
    const visitor = await ownInvitation(ctx, ctx.employee, args.visitorId);
    if (visitor.visitorStatus === "checkedOut" && visitor.isActive === false) return { status: "cancelled" as const };
    // Hosts cannot revoke operator-assigned cards or impersonate physical exits.
    if (!editableInvitation(visitor)) return { status: "operatorRequired" as const };
    await ctx.db.patch(visitor._id, { isActive: false, visitorStatus: "checkedOut", updatedAt: new Date().toISOString() });
    return { status: "cancelled" as const };
  },
});
