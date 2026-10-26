import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { getEmployeeTargetDevices, snapshotEmployeeHikDevices } from "./peopleHikSnapshot";
import { cardNumericKey } from "./cardIdentity";
import { employeeTransfer, transferBound, transferError, TRANSFER_LIMIT, transferOperationBelongsTo, isTransferAddition, TRANSFER_INVALID_OPERATION, type ReadCtx } from "./transferGuard";
export * from "./transferGuard";
import { deviceConnection } from "./deviceConnection";
import { hasPermission } from "./permissions";
import { enqueueIdeOpInTransaction } from "../ideSync";
import { beginPersonDeletionInTransaction, enqueueLocalBridgeOperationInTransaction } from "../hikvisionSync";

/** Snapshot graph, applied grants, pending deletions, and roster-only IDE cards.
 * Every read has a project/identity index and fails closed at its explicit budget. */
export async function snapshotTransferDevices(ctx: ReadCtx, employee: Doc<"employees">): Promise<Doc<"devices">[]> {
  if (!employee.cardNumber || !employee.projectId) return [];
  const projectId = employee.projectId;
  const devices = new Map<Id<"devices">, Doc<"devices">>();
  const add = async (id: Id<"devices">) => {
    const device = await ctx.db.get(id);
    if (device && device.projectId === employee.projectId && (device.brand === "hikvision" || device.brand === "ide_smart")) devices.set(id, device);
  };
  const hik = await snapshotEmployeeHikDevices(ctx, employee);
  for (const device of hik.devices) await add(device._id);
  const graph = await getEmployeeTargetDevices(ctx, employee);
  for (const device of graph.devices) await add(device._id);
  const grants = transferBound(await ctx.db.query("accessGrantStatus").withIndex("by_project_employee", q => q.eq("projectId", projectId).eq("employeeId", employee._id)).take(TRANSFER_LIMIT + 1));
  for (const grant of grants) if (grant.state !== "removed") await add(grant.deviceId);
  const cardKey = cardNumericKey(employee.cardNumber);
  const projectDevices = transferBound(await ctx.db.query("devices").withIndex("by_project", q => q.eq("projectId", employee.projectId)).take(TRANSFER_LIMIT + 1));
  for (const device of projectDevices) {
    if (device.brand !== "ide_smart" || !device.ideUuid || cardKey === null) continue;
    const roster = transferBound(await ctx.db.query("idePanelUsers").withIndex("by_uuid_card", q => q.eq("ideUuid", device.ideUuid ?? "").eq("cardNumber", cardKey)).take(TRANSFER_LIMIT + 1));
    if (roster.some(row => row.projectId === employee.projectId)) await add(device._id);
  }
  // Candidate devices are project-scoped; unrelated people never consume the identity budget.
  for (const device of projectDevices) {
    if (device.brand !== "hikvision" && device.brand !== "ide_smart") continue;
    const ops = await transferDeviceOperations(ctx, employee, device._id);
    if (ops.hik.length || ops.ide.length) await add(device._id);
  }
  return transferBound([...devices.values()]);
}
// A separate physical read budget keeps each device/status read bounded without charging
// other people's jobs against the 500-operation transfer identity budget.
async function transferQueueRows<T>(query: { take: (n: number) => Promise<T[]> }): Promise<T[]> {
  const rows = await query.take(4097);
  if (rows.length > 4096) transferError("TRANSFER_QUEUE_SCAN_LIMIT", "Cihaz kuyruğu okuma sınırı aşıldı. Önce cihazın bekleyen işlemlerini azaltın.");
  return rows;
}
export async function transferDeviceOperations(ctx: ReadCtx, employee: Doc<"employees">, deviceId: Id<"devices">) {
  const hik: Doc<"hikPendingOperations">[] = [];
  const ide: Doc<"idePendingOperations">[] = [];
  for (const status of ["pending", "processing", "failed"] as const) {
    const rows = await transferQueueRows(ctx.db.query("hikPendingOperations").withIndex("by_device_status", q => q.eq("deviceId", deviceId).eq("status", status)));
    hik.push(...rows.filter(op => (op.status === "processing" || op.dismissedAt === undefined) && transferOperationBelongsTo(op, employee)));
  }
  for (const status of ["pending", "sent", "failed"] as const) {
    const rows = await transferQueueRows(ctx.db.query("idePendingOperations").withIndex("by_device_status", q => q.eq("deviceId", deviceId).eq("status", status)));
    ide.push(...rows.filter(op => transferOperationBelongsTo(op, employee)));
  }
  transferBound([...hik, ...ide]);
  return { hik, ide };
}
export async function transferDeviceBusy(ctx: ReadCtx, employee: Doc<"employees">, deviceId: Id<"devices">): Promise<boolean> {
  const ops = await transferDeviceOperations(ctx, employee, deviceId);
  return ops.hik.some(op => op.status === "processing" && isTransferAddition(op)) || ops.ide.some(op => op.status === "sent" && isTransferAddition(op) && op.msxId !== undefined);
}
export async function invalidateTransferAdditions(ctx: MutationCtx, employee: Doc<"employees">, devices: Doc<"devices">[]): Promise<void> {
  for (const device of devices) {
    const ops = await transferDeviceOperations(ctx, employee, device._id);
    for (const op of ops.hik) if (isTransferAddition(op) && (op.status === "pending" || op.status === "failed"))
      await ctx.db.patch(op._id, { status: "done", completedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
    // A reserved upsert without msxId was never published; markSent rejects it after start.
    for (const op of ops.ide) if (isTransferAddition(op) && (op.status === "pending" || op.status === "failed" || (op.status === "sent" && op.msxId === undefined)))
      await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
  }
}
export async function transferPreflightData(ctx: ReadCtx, user: Doc<"users">, employee: Doc<"employees">, targetProjectId: Id<"projects">) {
  const reasons: { code: string; message: string }[] = [];
  const block = (code: string, message: string) => { reasons.push({ code, message }); };
  if (employee.isVisitor) block("TRANSFER_VISITOR", "Ziyaretçiler başka projeye taşınamaz.");
  if (employee.isActive !== true || employee.employmentEndDate) block("TRANSFER_INACTIVE", "Yalnız aktif ve işten ayrılmamış kişiler taşınabilir.");
  if (!employee.projectId) block("TRANSFER_NO_SOURCE", "Kişiyi önce bir projeye atayın.");
  if (employee.projectId === targetProjectId) block("TRANSFER_SAME_PROJECT", "Hedef olarak farklı bir proje seçin.");
  if (!await ctx.db.get(targetProjectId)) block("TRANSFER_TARGET_NOT_FOUND", "Hedef proje bulunamadı.");
  if (await employeeTransfer(ctx, employee._id)) block("TRANSFER_IN_PROGRESS", "Bu kişinin proje taşıması sürüyor. Önce mevcut taşımayı tamamlayın veya iptal edin.");
  for (const [projectId, label] of [[employee.projectId, "Kaynak"], [targetProjectId, "Hedef"]] as const) {
    if (!await hasPermission(ctx, user, projectId, "employees.manage")) block("TRANSFER_PERMISSION_DENIED", `${label} projede kişi yönetme yetkiniz yok.`);
    if ((employee.hourlyRate != null || employee.monthlySalary != null) && !await hasPermission(ctx, user, projectId, "pay.view")) block("TRANSFER_PAY_PERMISSION", `${label} projede ücret görüntüleme yetkiniz yok. Ücretli kişiyi taşımak için iki projede de bu yetki gerekir.`);
  }
  const visitors = transferBound(await ctx.db.query("employees").withIndex("by_project_host_visitor", q => q.eq("projectId", employee.projectId).eq("hostEmployeeId", employee._id).eq("isVisitor", true)).take(TRANSFER_LIMIT + 1));
  const activeVisitorCount = visitors.filter(visitor => visitor.isActive === true && visitor.visitorStatus !== "checkedOut" && visitor.visitorStatus !== "expired" && (!visitor.accessExpiresAt || visitor.accessExpiresAt > new Date().toISOString())).length;
  if (activeVisitorCount) block("TRANSFER_ACTIVE_VISITORS", `Bu kişi ${activeVisitorCount} aktif ziyaretçinin ev sahibi. Önce ziyaretleri kapatın veya ev sahibini değiştirin.`);
  const devices = await snapshotTransferDevices(ctx, employee);
  for (const device of devices) if (await transferDeviceBusy(ctx, employee, device._id)) block("TRANSFER_DEVICE_BUSY", `${device.name} cihazına giden bir işlem sürüyor; birkaç dakika sonra tekrar deneyin.`);
  const offlineDevices = devices.filter(device => deviceConnection(device, Date.now()) !== "online").map(device => ({ deviceId: device._id, name: device.name }));
  if (offlineDevices.length) block("TRANSFER_DEVICE_OFFLINE", `Taşıma başlatılamadı. Şu cihazları çevrimiçi yapın: ${offlineDevices.map(device => device.name).join(", ")}.`);
  return { reasons, devices, offlineDevices, activeVisitorCount, targetDeviceCount: devices.length };
}

/** Persist every deletion in the start transaction; a scheduled action is not proof of a job. */
export async function enqueueTransferDeletion(ctx: MutationCtx, employee: Doc<"employees">, device: Doc<"devices">, transferId: Id<"accessTransfers">): Promise<void> {
  if (!employee.cardNumber || !employee.projectId || device.projectId !== employee.projectId) transferError("TRANSFER_IDENTITY_CHANGED", "Silme kimliği veya cihazın projesi değişti. Taşımayı yeniden başlatın.");
  if (device.brand === "ide_smart") {
    const ideUserId = Number(employee.cardNumber);
    if (!Number.isSafeInteger(ideUserId) || ideUserId < 1) transferError("TRANSFER_INVALID_IDE_CARD", "IDE panelindeki kart numarası geçersiz. Kart bilgisini düzeltin.");
    await enqueueIdeOpInTransaction(ctx, { deviceId: device._id, projectId: employee.projectId, opType: "deleteUser", payload: { transferId, employeeId: employee._id, ideUserId }, maxAttempts: 50, forceNew: true });
  } else if (device.brand === "hikvision" && device.hikTransport === "localBridge") {
    await enqueueLocalBridgeOperationInTransaction(ctx, { deviceId: device._id, projectId: employee.projectId, operation: "deleteCard", forceNew: true, payload: { transferId, employeeId: employee._id, employeeNo: employee.cardNumber, cardNumber: employee.cardNumber } });
  } else if (device.brand === "hikvision") {
    const id: Id<"hikPendingOperations"> = await beginPersonDeletionInTransaction(ctx, { deviceId: device._id, projectId: employee.projectId, employeeId: employee._id, cardNumber: employee.cardNumber, transferId });
    await ctx.scheduler.runAfter(0, internal.actions.hikQueueWorker.processHikOperation, { issueId: id });
  }
}

