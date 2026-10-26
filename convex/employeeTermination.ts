import { requirePermission } from "./lib/permissions";
import { scheduleFingerprintPurge } from "./lib/employeeCardChange";
import { ConvexError, v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import { resolveEmployeeIdeDeviceIds } from "./lib/accessGraph";
import { writeAudit } from "./lib/audit";
import { trTodayKey } from "./lib/trDate";
import { enqueueTransferDeletion, invalidateTransferAdditions, transferPreflightData } from "./lib/accessTransfer";
import { advanceTransfer, assertNoEmployeeTransfer, employeeTransfer, operationPayload, transferBound, transferError, transferTargets, TRANSFER_LIMIT, TRANSFER_WINDOW_MS } from "./lib/transferGuard";
import { hasPermission } from "./lib/permissions";
import { findDuplicateCard } from "./lib/cardIdentity";
import { normalizeEmployeeEmail, removeEmployeeRecord, upsertGroupMembership } from "./employees";
import { deviceConnection, deviceLastSignal } from "./lib/deviceConnection";

async function accessibleEmployee(ctx: MutationCtx & { user: Doc<"users"> }, employeeId: Id<"employees">) {
  const employee = await ctx.db.get(employeeId);
  if (!employee) throw new ConvexError("Çalışan bulunamadı.");
  const projectIds = await getProjectIdsForUser(ctx);
  if (employee.projectId && !projectIds.includes(employee.projectId)) {
    throw new ConvexError("Bu çalışana erişim yetkiniz yok.");
  }
  await requirePermission(ctx, ctx.user, employee.projectId, "employees.manage");
  if (employee.isVisitor) throw new ConvexError("Ziyaretçiler için işten ayrılma işlemi yapılamaz.");
  return employee;
}

export async function closeAccess(ctx: MutationCtx, employee: Doc<"employees">, now: string, transferDevices?: Doc<"devices">[], transferId?: Id<"accessTransfers">) {
  // Panelleri aktif erişim grafından, pasife çekmeden önce çöz.
  const deviceIds = await resolveEmployeeIdeDeviceIds(ctx, employee._id, employee.projectId);
  await ctx.db.patch(employee._id, { isActive: false, updatedAt: now });
  await scheduleFingerprintPurge(ctx, employee._id, employee.cardNumber, { deleteTemplates: true });
  if (transferDevices && transferId) {
    for (const device of transferDevices) await enqueueTransferDeletion(ctx, employee, device, transferId);
    return;
  }
  await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
    employeeId: employee._id,
  });
  if (deviceIds.length) {
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, {
      cardNumber: employee.cardNumber, deviceIds, projectId: employee.projectId,
    });
  }
}

export const terminate = authedMutation({
  args: {
    employeeId: v.id("employees"), employmentEndDate: v.string(),
    terminationType: v.union(v.literal("resignation"), v.literal("employerTermination"), v.literal("retirement"), v.literal("contractEnd"), v.literal("other")),
    terminationReason: v.optional(v.string()), sgkExitCode: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const employee = await accessibleEmployee(ctx, args.employeeId);
    await assertNoEmployeeTransfer(ctx, employee._id);
    if (employee.employmentEndDate) throw new ConvexError("Bu kişi zaten işten çıkarılmış.");
    if (employee.isActive !== true) throw new ConvexError("Pasif kişi işten çıkarılamaz; önce aktif yapın.");
    const date = new Date(`${args.employmentEndDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.employmentEndDate) ||
        Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== args.employmentEndDate) {
      throw new ConvexError("Geçerli bir son çalışma günü girin.");
    }
    const today = trTodayKey();
    const earliest = new Date(`${today}T00:00:00.000Z`);
    earliest.setUTCDate(earliest.getUTCDate() - 62);
    if (args.employmentEndDate < earliest.toISOString().slice(0, 10)) {
      throw new ConvexError("Son çalışma günü en fazla 62 gün geriye girilebilir.");
    }
    const latest = new Date(`${today}T00:00:00.000Z`);
    latest.setUTCDate(latest.getUTCDate() + 365);
    if (args.employmentEndDate > latest.toISOString().slice(0, 10)) {
      throw new ConvexError("Son çalışma günü en fazla 365 gün ileride olabilir.");
    }
    if ((args.terminationReason?.length ?? 0) > 500) throw new ConvexError("Ayrılış nedeni en fazla 500 karakter olabilir.");
    if (args.sgkExitCode !== undefined && !/^\d{2}$/.test(args.sgkExitCode)) throw new ConvexError("SGK çıkış kodu 2 haneli rakam olmalıdır.");
    const now = new Date().toISOString();
    const { employeeId, ...details } = args;
    const updates = { ...details, terminatedAt: now, terminatedBy: ctx.user._id, updatedAt: now };
    await ctx.db.patch(employeeId, updates);
    if (args.employmentEndDate < today) {
      await closeAccess(ctx, employee, now);
    } else {
      await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
      await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId });
    }
    await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "update", targetTable: "employees", targetId: employeeId, oldValue: employee, newValue: { ...updates, isActive: args.employmentEndDate < today ? false : employee.isActive }, note: "İşten ayrılma" });
    return null;
  },
});

export const reinstate = authedMutation({
  args: { employeeId: v.id("employees") },
  returns: v.null(),
  handler: async (ctx, { employeeId }) => {
    const employee = await accessibleEmployee(ctx, employeeId);
    await assertNoEmployeeTransfer(ctx, employeeId);
    if (employee.terminationType === "transfer") transferError("TRANSFER_REINSTATE_FORBIDDEN", "Başka projeye taşınmış kişi geri alınamaz. Aktif taşıma varsa taşıma ekranından iptal edin.");
    if (!employee.employmentEndDate) throw new ConvexError("Bu kişi işten ayrılmamış.");
    await ctx.db.patch(employeeId, {
      employmentEndDate: undefined, terminationType: undefined, terminationReason: undefined,
      sgkExitCode: undefined, terminatedAt: undefined, terminatedBy: undefined,
      isActive: true, updatedAt: new Date().toISOString(),
    });
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId });
    await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "update", targetTable: "employees", targetId: employeeId, oldValue: employee, newValue: await ctx.db.get(employeeId), note: "İşten ayrılma geri alındı" });
    return null;
  },
});

export const closeEndedEmployments = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.object({ closed: v.number() }),
  handler: async (ctx, args) => {
    const today = trTodayKey();
    const batch = await ctx.db.query("employees")
      .withIndex("by_active_employment_end", q => q.eq("isActive", true).gt("employmentEndDate", "").lt("employmentEndDate", today))
      .paginate({ numItems: 50, cursor: args.cursor ?? null });
    const ended = batch.page.filter(employee => employee.isVisitor !== true);
    for (const employee of ended) await closeAccess(ctx, employee, new Date().toISOString());
    if (!batch.isDone) await ctx.scheduler.runAfter(0, internal.employeeTermination.closeEndedEmployments, { cursor: batch.continueCursor });
    return { closed: ended.length };
  },
});

async function validateTransferPlan(ctx: Pick<MutationCtx, "db">, projectId: Id<"projects">, accessRuleIds: Id<"accessRules">[], departmentId?: Id<"departments">): Promise<void> {
  transferBound(accessRuleIds, 100);
  for (const id of new Set(accessRuleIds)) {
    const rule = await ctx.db.get(id);
    if (!rule || rule.projectId !== projectId) transferError("TRANSFER_RULE_PROJECT", "Seçilen erişim kurallarının tümü hedef projeye ait olmalıdır.");
  }
  if (departmentId) {
    const department = await ctx.db.get(departmentId);
    if (!department || department.projectId !== projectId) transferError("TRANSFER_DEPARTMENT_PROJECT", "Seçilen departman hedef projeye ait olmalıdır.");
  }
}

async function transferManager(ctx: MutationCtx & { user: Doc<"users"> }, transferId: Id<"accessTransfers">): Promise<Doc<"accessTransfers">> {
  const transfer = await ctx.db.get(transferId);
  if (!transfer || transfer.kind !== "employee") transferError("TRANSFER_NOT_FOUND", "Taşıma bulunamadı. Kişi listesini yenileyin.");
  for (const projectId of [transfer.sourceProjectId, transfer.targetProjectId]) {
    if (!await hasPermission(ctx, ctx.user, projectId, "employees.manage")) transferError("TRANSFER_PERMISSION_DENIED", "Taşımayı yönetmek için her iki projede de kişi yönetme yetkisi gerekir.");
  }
  return transfer;
}

/** Target remains cardless until the final physical revocation acknowledgement. */
export const startTransfer = authedMutation({
  args: { employeeId: v.id("employees"), targetProjectId: v.id("projects"), accessRuleIds: v.array(v.id("accessRules")), departmentId: v.optional(v.id("departments")) },
  returns: v.object({ transferId: v.id("accessTransfers"), targetEmployeeId: v.id("employees") }),
  handler: async (ctx, args): Promise<{ transferId: Id<"accessTransfers">; targetEmployeeId: Id<"employees"> }> => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) transferError("TRANSFER_EMPLOYEE_NOT_FOUND", "Kişi bulunamadı. Listeyi yenileyin.");
    // Authorize before disclosing source visitors, devices or pay information.
    for (const projectId of [employee.projectId, args.targetProjectId]) if (!await hasPermission(ctx, ctx.user, projectId, "employees.manage")) transferError("TRANSFER_PERMISSION_DENIED", "Taşıma için kaynak ve hedef projede kişi yönetme yetkisi gerekir.");
    await assertNoEmployeeTransfer(ctx, employee._id);
    const preflight = await transferPreflightData(ctx, ctx.user, employee, args.targetProjectId);
    const first = preflight.reasons[0];
    if (first) transferError(first.code, first.message);
    if (!employee.projectId) transferError("TRANSFER_NO_SOURCE", "Kaynak proje bulunamadı.");
    if (args.accessRuleIds.length && !await hasPermission(ctx, ctx.user, args.targetProjectId, "accessRules.manage")) transferError("TRANSFER_RULE_PERMISSION", "Hedef projede erişim kuralı yönetme yetkiniz yok.");
    await validateTransferPlan(ctx, args.targetProjectId, args.accessRuleIds, args.departmentId);
    // Transfer lineage is allowed to share profile identifiers; unrelated people are not.
    for (const [field, index, value] of [["email", "by_email", normalizeEmployeeEmail(employee.email) ?? ""], ["tcNo", "by_tc", employee.tcNo]] as const) {
      if (!value) continue;
      const matches = transferBound(await ctx.db.query("employees").withIndex(index, q => q.eq(field, value)).take(TRANSFER_LIMIT + 1));
      if (matches.some(match => match._id !== employee._id && match.terminationType !== "transfer")) transferError("TRANSFER_PROFILE_CONFLICT", `${field === "email" ? "E-posta adresi" : "TC kimlik numarası"} başka bir kişi kaydında kullanılıyor. Önce çakışmayı düzeltin.`);
    }
    const memberships = transferBound(await ctx.db.query("groupMembers").withIndex("by_project_employee", q => q.eq("projectId", employee.projectId).eq("employeeId", employee._id)).take(101), 100);
    // Resolve before relationships are removed, including graph-only panels.
    const ideIds = employee.cardNumber ? await resolveEmployeeIdeDeviceIds(ctx, employee._id, employee.projectId) : [];
    const devices = new Map(preflight.devices.map(device => [device._id, device]));
    for (const id of ideIds) {
      const device = await ctx.db.get(id);
      if (device?.projectId === employee.projectId) devices.set(id, device);
    }
    transferBound([...devices.values()]);
    for (const device of devices.values()) if (deviceConnection(device, Date.now()) !== "online") transferError("TRANSFER_DEVICE_OFFLINE", `Taşıma başlatılamadı. ${device.name} cihazını çevrimiçi yapın.`);
    await invalidateTransferAdditions(ctx, employee, [...devices.values()]);
    const now = new Date().toISOString();
    const targetEmployeeId = await ctx.db.insert("employees", {
      projectId: args.targetProjectId, firstName: employee.firstName, lastName: employee.lastName,
      email: normalizeEmployeeEmail(employee.email) ?? "", tcNo: employee.tcNo, payrollCode: employee.payrollCode,
      photoUrl: employee.photoUrl, photoStorageId: employee.photoStorageId, notes: employee.notes,
      hourlyRate: employee.hourlyRate, monthlySalary: employee.monthlySalary,
      departmentId: args.departmentId, cardNumber: "", isActive: true, transferredFromEmployeeId: employee._id,
      createdAt: now, updatedAt: now,
    });
    const transferId = await ctx.db.insert("accessTransfers", {
      kind: "employee", status: "revoking", sourceProjectId: employee.projectId, targetProjectId: args.targetProjectId,
      employeeId: employee._id, targetEmployeeId, cardNumber: employee.cardNumber,
      targetPlan: { accessRuleIds: [...new Set(args.accessRuleIds)], departmentId: args.departmentId },
      sourceAccessRuleIds: [...new Set(memberships.map(member => member.groupId))],
      requestedBy: ctx.user._id, requestedAt: Date.now(), deadlineAt: Date.now() + TRANSFER_WINDOW_MS,
    });
    for (const device of devices.values()) {
      if (device.brand !== "hikvision" && device.brand !== "ide_smart") continue;
      await ctx.db.insert("accessTransferTargets", { transferId, employeeId: employee._id, deviceId: device._id, brand: device.brand, state: "pending", updatedAt: Date.now() });
    }
    await ctx.db.patch(employee._id, { isActive: false, employmentEndDate: trTodayKey(), terminationType: "transfer", terminatedAt: now, terminatedBy: ctx.user._id, transferredToEmployeeId: targetEmployeeId, updatedAt: now });
    await closeAccess(ctx, employee, now, [...devices.values()], transferId);
    for (const member of memberships) await ctx.db.delete(member._id);
    for (const table of ["employeeSessions", "employeeAuth"] as const) {
      const rows = transferBound(await ctx.db.query(table).withIndex("by_employee", q => q.eq("employeeId", employee._id)).take(TRANSFER_LIMIT + 1));
      for (const row of rows) await ctx.db.delete(row._id);
    }
    await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "create", targetTable: "accessTransfers", targetId: transferId, newValue: { employeeId: employee._id, targetEmployeeId, targetProjectId: args.targetProjectId, targetDeviceCount: devices.size }, note: "Başka projeye taşıma başlatıldı" });
    if (devices.size === 0) {
      await ctx.db.patch(transferId, { status: "revoked" });
      await finishTransfer(ctx, transferId);
    }
    return { transferId, targetEmployeeId };
  },
});

async function finishTransfer(ctx: MutationCtx, transferId: Id<"accessTransfers">): Promise<void> {
  const transfer = await ctx.db.get(transferId);
  if (!transfer || transfer.status !== "revoked" || transfer.kind !== "employee") return;
  const targets = await transferTargets(ctx, transferId);
  if (targets.some(target => target.state !== "confirmed" && target.state !== "deviceRemoved")) return;
  const [source, target] = await Promise.all([ctx.db.get(transfer.employeeId), ctx.db.get(transfer.targetEmployeeId)]);
  const conflict = transfer.cardNumber ? await findDuplicateCard(ctx, transfer.cardNumber, transfer.employeeId) : null;
  let error: string | undefined;
  if (!source || !target || source.projectId !== transfer.sourceProjectId || target.projectId !== transfer.targetProjectId || source.cardNumber !== transfer.cardNumber || target.cardNumber !== "") error = "Taşıma kayıtları değişti. Taşımayı iptal edip tekrar başlatın.";
  else if (conflict) error = "Kart numarası başka bir kişide kullanılıyor. Çakışmayı giderip yeniden deneyin.";
  try { await validateTransferPlan(ctx, transfer.targetProjectId, transfer.targetPlan.accessRuleIds, transfer.targetPlan.departmentId); }
  catch { error = "Hedef kural veya departman artık hedef projede değil. Taşımayı iptal edip yeniden başlatın."; }
  if (error || !source || !target) {
    await ctx.db.patch(transferId, { status: "stuck", stuckReason: error, lastError: error });
    return;
  }
  await ctx.db.patch(transferId, { status: "provisioning" });
  const now = new Date().toISOString();
  await ctx.db.patch(source._id, { cardNumber: "", transferredCardNumber: transfer.cardNumber, updatedAt: now });
  await ctx.db.patch(target._id, { cardNumber: transfer.cardNumber, departmentId: transfer.targetPlan.departmentId, updatedAt: now });
  for (const ruleId of transfer.targetPlan.accessRuleIds) await upsertGroupMembership(ctx, target._id, ruleId, transfer.targetProjectId);
  await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: target._id });
  await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId: target._id });
  await ctx.db.patch(transferId, { status: "done", completedAt: Date.now(), stuckReason: undefined, lastError: undefined });
  const user = await ctx.db.get(transfer.requestedBy);
  for (const projectId of [transfer.sourceProjectId, transfer.targetProjectId]) await writeAudit(ctx, { user, projectId, action: "update", targetTable: "accessTransfers", targetId: transferId, newValue: { status: "done", employeeId: source._id, targetEmployeeId: target._id }, note: "Başka projeye taşıma tamamlandı" });
}
export const completeTransfer = internalMutation({
  args: { transferId: v.id("accessTransfers") }, returns: v.null(),
  handler: async (ctx, { transferId }): Promise<null> => { await finishTransfer(ctx, transferId); return null; },
});

export const cancelTransfer = authedMutation({
  args: { transferId: v.id("accessTransfers") }, returns: v.null(),
  handler: async (ctx, { transferId }): Promise<null> => {
    const transfer = await transferManager(ctx, transferId);
    if (transfer.status !== "revoking" && transfer.status !== "stuck") transferError("TRANSFER_CANNOT_CANCEL", "Yalnız silme bekleyen veya takılan taşıma iptal edilebilir.");
    const [source, target] = await Promise.all([ctx.db.get(transfer.employeeId), ctx.db.get(transfer.targetEmployeeId)]);
    if (!source || !target || target.cardNumber || source.cardNumber !== transfer.cardNumber) transferError("TRANSFER_IDENTITY_CHANGED", "Taşıma kimliği değişti. Yöneticinizle iletişime geçin.");
    // Close first: cascade and any late ACK must observe cancelled and cannot provision B.
    await ctx.db.patch(transferId, { status: "cancelled", completedAt: Date.now() });
    const targets = await transferTargets(ctx, transferId);
    for (const row of targets) {
      if (row.state !== "confirmed" && row.state !== "deviceRemoved") await ctx.db.patch(row._id, { state: "superseded", lastError: "Taşıma iptal edildi", updatedAt: Date.now() });
      for (const status of ["pending", "processing", "failed"] as const) {
        const ops = transferBound(await ctx.db.query("hikPendingOperations").withIndex("by_device_status", q => q.eq("deviceId", row.deviceId).eq("status", status)).take(TRANSFER_LIMIT + 1));
        for (const op of ops) if ((op.operation === "deletePerson" || op.operation === "deleteCard") && operationPayload(op.payload).employeeId === source._id) await ctx.db.patch(op._id, { status: "done", completedAt: Date.now(), lastError: "Taşıma iptal edildi" });
      }
      for (const status of ["pending", "sent", "failed"] as const) {
        const ops = transferBound(await ctx.db.query("idePendingOperations").withIndex("by_device_status", q => q.eq("deviceId", row.deviceId).eq("status", status)).take(TRANSFER_LIMIT + 1));
        for (const op of ops) if (op.opType === "deleteUser" && operationPayload(op.payload).employeeId === source._id) await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: "Taşıma iptal edildi" });
      }
    }
    await ctx.db.patch(source._id, { employmentEndDate: undefined, terminationType: undefined, terminationReason: undefined, sgkExitCode: undefined, terminatedAt: undefined, terminatedBy: undefined, transferredToEmployeeId: undefined, isActive: true, updatedAt: new Date().toISOString() });
    for (const ruleId of transfer.sourceAccessRuleIds) {
      const rule = await ctx.db.get(ruleId);
      if (rule?.projectId === source.projectId) await upsertGroupMembership(ctx, source._id, ruleId, source.projectId);
    }
    await removeEmployeeRecord(ctx, target, ctx.user);
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: source._id });
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId: source._id });
    await writeAudit(ctx, { user: ctx.user, projectId: source.projectId, action: "update", targetTable: "accessTransfers", targetId: transferId, newValue: { status: "cancelled" }, note: "Başka projeye taşıma iptal edildi" });
    return null;
  },
});

export const retryTransfer = authedMutation({
  args: { transferId: v.id("accessTransfers") }, returns: v.null(),
  handler: async (ctx, { transferId }): Promise<null> => {
    const transfer = await transferManager(ctx, transferId);
    if (transfer.status !== "stuck") transferError("TRANSFER_CANNOT_RETRY", "Yalnız takılan taşıma yeniden denenebilir.");
    const targets = await transferTargets(ctx, transferId);
    if (targets.some(target => target.state === "superseded")) transferError("TRANSFER_SUPERSEDED", "Bir silme işi geçersiz kılındı. Taşımayı iptal edin veya ilgili cihazı kaynak projeden kaldırın.");
    const source = await ctx.db.get(transfer.employeeId);
    if (!source || source.cardNumber !== transfer.cardNumber) transferError("TRANSFER_IDENTITY_CHANGED", "Kaynak kart değişti. Taşımayı iptal edin.");
    await ctx.db.patch(transferId, { status: "revoking", deadlineAt: Date.now() + TRANSFER_WINDOW_MS, stuckReason: undefined, lastError: undefined });
    // Pending may itself have exhausted its Hik worker retries; requeue every unconfirmed target.
    for (const row of targets) if (row.state === "failed" || row.state === "pending") {
      const device = await ctx.db.get(row.deviceId);
      if (!device || device.projectId !== transfer.sourceProjectId) continue; // removal hook owns this transition
      await ctx.db.patch(row._id, { state: "pending", lastError: undefined, updatedAt: Date.now() });
      await enqueueTransferDeletion(ctx, source, device, transferId);
    }
    await advanceTransfer(ctx, transferId);
    await writeAudit(ctx, { user: ctx.user, projectId: source.projectId, action: "update", targetTable: "accessTransfers", targetId: transferId, newValue: { status: "revoking" }, note: "Başka projeye taşıma yeniden denendi" });
    return null;
  },
});

export const expireTransfers = internalMutation({
  args: { cursor: v.optional(v.string()) }, returns: v.object({ stuck: v.number() }),
  handler: async (ctx, args): Promise<{ stuck: number }> => {
    const batch = await ctx.db.query("accessTransfers").withIndex("by_status_deadline", q => q.eq("status", "revoking").lt("deadlineAt", Date.now())).paginate({ numItems: 50, cursor: args.cursor ?? null });
    for (const transfer of batch.page) await ctx.db.patch(transfer._id, { status: "stuck", stuckReason: "24 saat içinde tüm cihazlardan silme onayı alınamadı. Yeniden deneyin veya taşımayı iptal edin." });
    if (!batch.isDone) await ctx.scheduler.runAfter(0, internal.employeeTermination.expireTransfers, { cursor: batch.continueCursor });
    return { stuck: batch.page.length };
  },
});

export const transferPreflight = authedQuery({
  args: { employeeId: v.id("employees"), targetProjectId: v.id("projects") },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee || !await hasPermission(ctx, ctx.user, employee.projectId, "employees.view")) transferError("TRANSFER_PERMISSION_DENIED", "Bu kişiyi görüntüleme yetkiniz yok.");
    const data = await transferPreflightData(ctx, ctx.user, employee, args.targetProjectId);
    // Device identities stay in the source project's view scope.
    return { reasons: data.reasons, offlineDevices: data.offlineDevices, activeVisitorCount: data.activeVisitorCount, targetDeviceCount: data.targetDeviceCount };
  },
});

export const getEmployeeTransfer = authedQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, { employeeId }) => {
    const employee = await ctx.db.get(employeeId);
    if (!employee || !await hasPermission(ctx, ctx.user, employee.projectId, "employees.view")) transferError("TRANSFER_PERMISSION_DENIED", "Bu kişiyi görüntüleme yetkiniz yok.");
    const transfer = await employeeTransfer(ctx, employeeId, true);
    if (!transfer) return null;
    const isSource = transfer.employeeId === employeeId;
    const counterpartId = isSource ? transfer.targetProjectId : transfer.sourceProjectId;
    const counterpart = await ctx.db.get(counterpartId);
    const canSeeSource = await hasPermission(ctx, ctx.user, transfer.sourceProjectId, "employees.view");
    const canSeeCounterpart = await hasPermission(ctx, ctx.user, counterpartId, "employees.view");
    const canManage = await hasPermission(ctx, ctx.user, transfer.sourceProjectId, "employees.manage") && await hasPermission(ctx, ctx.user, transfer.targetProjectId, "employees.manage");
    const rows = canSeeSource ? await transferTargets(ctx, transfer._id) : [];
    const targets = await Promise.all(rows.map(async target => {
      const device = await ctx.db.get(target.deviceId);
      return { deviceId: target.deviceId, deviceName: device?.name ?? "Kaldırılan cihaz", brand: target.brand, state: target.state, lastSeen: device ? deviceLastSignal(device) ?? null : null, lastError: target.lastError ?? null, confirmedAt: target.confirmedAt ?? null };
    }));
    return { transferId: transfer._id, status: transfer.status, counterpartProjectName: counterpart?.name ?? "Silinen proje",
      requestedAt: transfer.requestedAt, deadlineAt: transfer.deadlineAt, completedAt: transfer.completedAt ?? null,
      stuckReason: canSeeSource ? transfer.stuckReason ?? null : null, lastError: canSeeSource ? transfer.lastError ?? null : null,
      counterpartEmployeeId: canSeeCounterpart ? (isSource ? transfer.targetEmployeeId : transfer.employeeId) : null,
      targets, canCancel: canManage && (transfer.status === "revoking" || transfer.status === "stuck"),
      canRetry: canManage && transfer.status === "stuck" && !rows.some(target => target.state === "superseded") };
  },
});
