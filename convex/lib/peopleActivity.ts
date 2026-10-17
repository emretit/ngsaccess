export type EmployeeSyncState = "queued" | "processing" | "failed" | "verified" | "unknown";

export const PEOPLE_OPERATION_SCAN_LIMIT = 100;
export const PEOPLE_MEMBERSHIP_LIMIT = 100;
export const PEOPLE_DEVICE_LINK_LIMIT = 500;
export const PEOPLE_CARD_OWNER_SCAN_LIMIT = 500;

type OperationBase = {
  _id: string;
  _creationTime: number;
  deviceId: string;
  payload: unknown;
  createdAt: number;
  lastError?: string;
};

export type EmployeeActivityOperation = OperationBase & (
  | {
    source: "hikvision";
    status: "pending" | "processing" | "failed" | "done";
    processingStartedAt?: number;
    completedAt?: number;
  }
  | {
    source: "ide_smart";
    status: "pending" | "sent" | "failed" | "acked";
    opType: string;
    sentAt?: number;
    ackedAt?: number;
  }
);

type ActivityDevice = {
  id: string;
  name: string;
  brand: "hikvision" | "ide_smart" | "other" | null;
};

/** Açık kişi bağı varsa başka kart/kişi üzerinden eşleşmeye geri düşülmez. */
export function operationBelongsToEmployee(payload: unknown, employeeId: string): boolean {
  return typeof payload === "object" && payload !== null &&
    "employeeId" in payload && payload.employeeId === employeeId;
}

/** IDE panelinin sayısal user.id normalizasyonu; boş/nesne/unsafe sayı kabul edilmez. */
export function normalizeActivityCard(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
}

export function uniqueEmployeeCard(
  employees: readonly { _id: string; cardNumber: string }[],
  employeeId: string,
  truncated: boolean,
): string | null {
  if (truncated) return null;
  const employee = employees.find(row => row._id === employeeId);
  const card = normalizeActivityCard(employee?.cardNumber);
  if (!card) return null;
  return employees.filter(row => normalizeActivityCard(row.cardNumber) === card).length === 1 ? card : null;
}

function matchesOperation(
  op: EmployeeActivityOperation,
  employeeId: string,
  ideIdentity?: { cardNumber: string | null; employeeCreatedAt: number },
): boolean {
  if (op.source === "hikvision") return operationBelongsToEmployee(op.payload, employeeId);
  if (ideIdentity && !ideIdentity.cardNumber) return false;
  if (typeof op.payload !== "object" || op.payload === null) return false;
  if ("employeeId" in op.payload) return operationBelongsToEmployee(op.payload, employeeId);
  // Önceki kart sahibinin işlemi yeni kişiye kanıt olamaz.
  if (!ideIdentity?.cardNumber || op.createdAt < ideIdentity.employeeCreatedAt) return false;
  const payload = op.payload;
  const record = "userRecord" in payload ? payload.userRecord : null;
  const card = op.opType === "upsertUser" && typeof record === "object" && record !== null && "id" in record
    ? record.id : op.opType === "deleteUser" && "ideUserId" in payload ? payload.ideUserId : null;
  return normalizeActivityCard(card) === ideIdentity.cardNumber;
}

function operationTime(op: EmployeeActivityOperation): number {
  const times = op.source === "hikvision"
    ? [op.createdAt, op.processingStartedAt, op.completedAt]
    : [op.createdAt, op.sentAt, op.ackedAt];
  return Math.max(...times.filter((value): value is number =>
    value !== undefined && Number.isFinite(value)));
}

function stateForOperation(op: EmployeeActivityOperation): EmployeeSyncState {
  if (op.status === "pending") return "queued";
  if (op.status === "processing" || op.status === "sent") return "processing";
  if (op.status === "failed") return "failed";
  // Silme onayı kişi kaydının hedef cihazda bulunduğunu kanıtlamaz.
  if (op.source === "ide_smart" && op.opType === "upsertUser" &&
    op.status === "acked" && op.ackedAt !== undefined && Number.isFinite(op.ackedAt)) {
    return "verified";
  }
  // Hik done, kapatma/temizlik sonucu da olabilir; teslim kanıtı değildir.
  return "unknown";
}

export function decideEmployeeDeviceStatuses<TDevice extends ActivityDevice>(
  devices: readonly TDevice[],
  employeeId: string,
  operations: readonly EmployeeActivityOperation[],
  scanTruncated: { hikvision: boolean; ide_smart: boolean },
  ideEvidence?: {
    cardNumber: string | null;
    employeeCreatedAt: number;
    roster: readonly { deviceId: string; syncedAt: number }[];
  },
) {
  const latest = new Map<string, EmployeeActivityOperation>();
  // İstek sırası esastır: eski işin geç gelen onayı daha yeni isteği doğrulamaz.
  for (const op of [...operations].sort((a, b) =>
    a.createdAt - b.createdAt || a._creationTime - b._creationTime || a._id.localeCompare(b._id))) {
    if (matchesOperation(op, employeeId, ideEvidence)) {
      latest.set(`${op.source}:${op.deviceId}`, op);
    }
  }
  const rows = devices.map(device => {
    const op = latest.get(`${device.brand}:${device.id}`);
    const truncated = device.brand === "hikvision" || device.brand === "ide_smart"
      ? scanTruncated[device.brand] : false;
    // Tamamlanmamış bir durum aralığında daha yeni kişi işlemi saklı olabilir.
    const roster = device.brand === "ide_smart" && ideEvidence?.cardNumber
      ? ideEvidence.roster.find(row => row.deviceId === device.id &&
        Number.isFinite(row.syncedAt) && row.syncedAt >= ideEvidence.employeeCreatedAt) : undefined;
    const status: EmployeeSyncState = truncated ? "unknown" : op ? stateForOperation(op) :
      roster ? "verified" : "unknown";
    return {
      device,
      status,
      lastChangedAt: op ? operationTime(op) : roster?.syncedAt ?? null,
      ...(op?.lastError ? { errorMessage: op.lastError } : {}),
    };
  });
  const summary = { total: rows.length, failed: 0, pending: 0, verified: 0, unknown: 0 };
  for (const row of rows) {
    if (row.status === "queued" || row.status === "processing") summary.pending++;
    else summary[row.status]++;
  }
  return { devices: rows, summary };
}

export function normalizeRecentReadingsLimit(limit?: number): number {
  return limit === undefined || !Number.isFinite(limit) ? 10 : Math.max(1, Math.min(50, Math.floor(limit)));
}

/** Girdiler index'ten sınırlı okunur; proje süzmesi birleştirme/limitten önce yapılır. */
export function mergeRecentReadings<T extends { _id: string; accessTime: string; projectId?: string }>(
  lists: readonly (readonly T[])[],
  projectId: string,
  limit?: number,
): T[] {
  return lists.flat().filter(row => row.projectId === projectId).sort((a, b) => {
    const delta = Date.parse(b.accessTime) - Date.parse(a.accessTime);
    return (Number.isFinite(delta) ? delta : b.accessTime.localeCompare(a.accessTime)) ||
      b._id.localeCompare(a._id);
  }).slice(0, normalizeRecentReadingsLimit(limit));
}
