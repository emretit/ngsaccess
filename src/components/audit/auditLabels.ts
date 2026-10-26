import { formatTrDateTime } from "@/lib/date";

const commonLabels: Record<string, string> = {
  visitorKvkkUrl: "Ziyaretçi aydınlatma metni bağlantısı",
  visitorKvkkVersion: "Ziyaretçi aydınlatma metni sürümü",
  documentVersion: "Belge sürümü",
  assigned: "Atanan kayıt sayısı",
  imported: "İçe aktarılan kayıt sayısı",
  skipped: "Atlanan kayıt sayısı",
  actorType: "İşlemi yapanın türü",
  baslatan: "Başlatan",
  userId: "Kullanıcı kimliği",
  batches: "İşlenen grup sayısı",
  cutoff: "Saklama sınırı tarihi",
  dailyLimitReached: "Günlük sınıra ulaşıldı",
  deleted: "Silinen kayıt sayısı",
  stoppedBySettingsChange: "Ayar değişikliği nedeniyle durduruldu",
  ackedAt: "Onaylanma zamanı",
  emailEnabled: "E-posta bildirimi",
  minSeverity: "En düşük bildirim önemi",
  recipientCount: "Alıcı sayısı",
  alarmEmailTest: "Alarm test e-postası",
  exported: "Dışa aktarılan kayıt sayısı",
  cardNumber: "Kart numarası",
  readingId: "Kart okuma kimliği",
  insertedCount: "Eklenen kayıt sayısı",
  years: "Yıllar",
  errors: "Hatalar",
  inserted: "Eklenen kayıt sayısı",
  touched: "İşlenen kayıt sayısı",
  updated: "Güncellenen kayıt sayısı",
  biometricEnabled: "Biyometrik veri işleme",
  biometricReason: "Biyometrik veri işleme gerekçesi",
  biometricChangedAt: "Biyometrik ayar değişiklik zamanı",
  biometricChangedBy: "Biyometrik ayarı değiştiren",
  cardReadingRetentionDays: "Kart okuma saklama süresi (gün)",
  aiMaskNames: "Yapay zekâda adları gizleme",
  name: "Ad",
  fullName: "Ad soyad",
  firstName: "Ad",
  lastName: "Soyad",
  email: "E-posta",
  employeeId: "Çalışan kimliği",
  employeeIds: "Çalışan kimlikleri",
  accessStartsAt: "Erişim başlangıcı",
  startDate: "Başlangıç tarihi",
  endDate: "Bitiş tarihi",
  trimmed: "Kırpılan atama sayısı",
  split: "Bölünen atama sayısı",
  affectedEmployees: "Etkilenen çalışan sayısı",
  affectsPast: "Geçmiş günleri etkiler",
  projectId: "Proje kimliği",
  date: "Tarih",
  status: "Durum",
  note: "Not",
  notes: "Notlar",
  createdAt: "Oluşturulma zamanı",
  updatedAt: "Güncellenme zamanı",
  _id: "Kayıt kimliği",
  _creationTime: "Kayıt zamanı",
  entryTime: "Giriş saati",
  exitTime: "Çıkış saati",
  manualNote: "Düzeltme notu",
  manualEntry: "Elle giriş",
  editedBy: "Düzenleyen",
  editedAt: "Düzenleme zamanı",
  consentType: "Rıza türü",
  grantedAt: "Rıza zamanı",
  revokedAt: "İptal zamanı",
  grantedBy: "Rızayı kaydeden",
  revokedBy: "İptal eden",
  documentUrl: "Belge bağlantısı",
  documentStorageId: "Rıza belgesi",
  weekdayMultiplier: "Hafta içi çarpanı",
  weekendMultiplier: "Hafta sonu çarpanı",
  holidayMultiplier: "Tatil çarpanı",
  nightShiftMultiplier: "Gece vardiyası çarpanı",
  nightShiftStart: "Gece vardiyası başlangıcı",
  nightShiftEnd: "Gece vardiyası bitişi",
  cascade: "Bağlı kayıtlar",
  faces: "Yüz kayıtları",
  fingerprints: "Parmak izi kayıtları",
  consentsRevoked: "İptal edilen rızalar",
  readingsAnonymized: "Anonimleştirilen okumalar",
  readingsAnonymizationPending: "Anonimleştirme sürüyor",
  inviteId: "Davet",
  passwordReset: "Şifre sıfırlandı",
};
const tableLabels: Record<string, Record<string, string>> = {
  hikPendingOperations: { dismissedAt: "Uyarının kapatılma zamanı" },
  userProjects: { role: "Proje rolü" },
  projectRolePermissions: { permissions: "Rol yetkileri", default: "Varsayılan yetkiler" },
  holidays: { name: "Tatil adı", type: "Tatil türü", isHalfDay: "Yarım gün" },
  generalSettings: { workingDays: "Çalışma günleri" },
  employees: {
    cardNo: "Kart numarası",
    department: "Bölüm",
    title: "Unvan",
    isActive: "Aktif",
  },
};

export function auditFieldLabel(table: string, path: string): string {
  return path
    .split(".")
    .map((field) => tableLabels[table]?.[field] ?? commonLabels[field] ?? field)
    .join(" / ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function equalValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return (
      a.length === b.length && a.every((value, i) => equalValue(value, b[i]))
    );
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(b, key) &&
          equalValue(a[key], b[key]),
      )
    );
  }
  return false;
}

export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
}

export function auditChanges(
  before: unknown,
  after: unknown,
  path = "",
): AuditChange[] {
  if (equalValue(before, after)) return [];
  if (
    (isRecord(before) || before == null) &&
    (isRecord(after) || after == null) &&
    (isRecord(before) || isRecord(after))
  ) {
    const oldFields = isRecord(before) ? before : {};
    const newFields = isRecord(after) ? after : {};
    return [
      ...new Set([...Object.keys(oldFields), ...Object.keys(newFields)]),
    ].flatMap((key) =>
      auditChanges(
        oldFields[key],
        newFields[key],
        path ? `${path}.${key}` : key,
      ),
    );
  }
  return [{ field: path || "Değer", before, after }];
}

export function auditDisplayValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (value === true) return "Evet";
  if (value === false) return "Hayır";
  if (value === "") return "(boş)";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

// KVKK: denetim ayrıntısında kimlik/iletişim/kart değerleri kısmen, sırlar tamamen gizlenir.
const partialMaskFields = new Set([
  "tcNo",
  "cardNumber",
  "cardNo",
  "phone",
  "visitorPhone",
  "payrollCode",
]);
const secretFields = new Set([
  "password",
  "idePassword",
  "apiToken",
  "token",
  "secret",
  "pin",
]);

function maskLeaf(key: string, value: unknown): unknown {
  if (value === undefined || value === null || value === "") return value;
  if (secretFields.has(key)) return "•••• (gizli)";
  if (key === "email" && typeof value === "string") {
    const [local, domain] = value.split("@");
    return domain ? `${local.slice(0, 1)}•••@${domain}` : "••••";
  }
  if (partialMaskFields.has(key)) {
    const text = String(value);
    return text.length > 4 ? `•••• ${text.slice(-4)}` : "••••";
  }
  return value;
}

export function maskAuditValue(path: string, value: unknown): unknown {
  const key = path.split(".").pop() ?? path;
  return isRecord(value) || Array.isArray(value)
    ? redactAuditValue(value)
    : maskLeaf(key, value);
}

export function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [
      key,
      isRecord(field) || Array.isArray(field)
        ? redactAuditValue(field)
        : maskLeaf(key, field),
    ]),
  );
}

const auditEnumLabels: Record<string, string> = {
  biometric_face: 'Yüz biyometrisi', biometric_fingerprint: 'Parmak izi biyometrisi',
  explicit_consent: 'Açık rıza', granted: 'Onaylandı', revoked: 'İptal edildi',
  warning: 'Uyarı', critical: 'Kritik',
};
/** Format only recognized field/value combinations; unknown data remains inspectable. */
export function auditFieldDisplayValue(field: string, value: unknown): string {
  if (value === undefined || value === null) return 'Kaydedilmedi';
  const key = field.split('.').pop() ?? field;
  if (typeof value === 'string') {
    if ((key === 'consentType' || key === 'status' || key === 'minSeverity') && auditEnumLabels[value]) return auditEnumLabels[value];
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:/.test(value) && !Number.isNaN(Date.parse(value))) {
      return formatTrDateTime(new Date(value), { seconds: true });
    }
    if (key === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('.');
  }
  if (typeof value === 'number' && ['timestamp', 'grantedAt', 'revokedAt', 'createdAt', 'updatedAt'].includes(key) && Number.isFinite(value) && Math.abs(value) < 8.64e15) {
    return formatTrDateTime(value, { seconds: true });
  }
  return auditDisplayValue(value);
}
