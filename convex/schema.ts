import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * NGS Access - Convex Schema
 * authTables: Convex Auth tarafından yönetilen tablolar (authAccounts, authSessions vb.)
 * users tablosu authTables'tan genişletilmiştir (role, photoUrl, setupToken eklendi)
 */
export default defineSchema({
  ...authTables,

  // ═══════ 1 · KİMLİK · PROJE · YETKİLENDİRME ═══════════════════════════
  // users tablosunu authTables'tan override ediyoruz, custom alanlar ekleniyor
  users: defineTable({
    // Convex Auth core fields
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Custom NGS fields
    fullName: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("super_admin"),
        v.literal("project_admin"),
        v.literal("project_user")
      )
    ),
    // E-posta doğrulama (self-signup): verified=false olan kullanıcı login olamaz.
    // Eski kullanıcılar undefined → guard yalnızca === false olanları engeller.
    // NOT: "emailVerified" adı kullanılamaz — Convex Auth onu profile()'dan ayıklayıp
    // kendi iç mantığında (emailVerificationTime) kullanır, users'a yazmaz.
    verified: v.optional(v.boolean()),
    // Kayıt formundaki firma adı; ilk doğrulanmış girişte projeye dönüştürülür.
    firstCompanyName: v.optional(v.string()),
    setupToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("by_setup_token", ["setupToken"])
    .index("by_role", ["role"]),

  userProjects: defineTable({
    userId: v.id("users"),
    projectId: v.id("projects"),
    createdAt: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"]),

  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    isActive: v.optional(v.boolean()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }),

  // ═══════ 2 · ÇALIŞANLAR · KİMLİK DOĞRULAMA · ORGANİZASYON ══════════════
  employees: defineTable({
    projectId: v.optional(v.id("projects")),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    tcNo: v.optional(v.string()),
    cardNumber: v.string(),
    payrollCode: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    companyId: v.optional(v.id("companies")),
    positionId: v.optional(v.id("positions")),
    shiftId: v.optional(v.id("shifts")),
    accessRuleId: v.optional(v.id("accessRules")),
    photoUrl: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    shift: v.optional(v.string()),
    hourlyRate: v.optional(v.number()),
    monthlySalary: v.optional(v.number()),
    // --- Ziyaretçi modülü (geçici erişim) ---
    // Bu kayıt bir ziyaretçi mi? true ise Kişiler listesinden gizlenir, Ziyaretçiler
    // sekmesinde görünür. Cihaz sync / kart eşleştirme / canlı izleme aynen çalışır.
    isVisitor: v.optional(v.boolean()),
    // ISO UTC — bu andan sonra erişim cron ile otomatik iptal (isActive=false → desync).
    accessExpiresAt: v.optional(v.string()),
    // Ziyaret başlangıcı (log/raporlama; cihaz erişimini etkilemez).
    accessStartsAt: v.optional(v.string()),
    visitorCompany: v.optional(v.string()),
    visitorPhone: v.optional(v.string()),
    visitPurpose: v.optional(v.string()),
    // Ziyaret edilen personel.
    hostEmployeeId: v.optional(v.id("employees")),
    // UI yaşam döngüsü; cihaz erişimini isActive belirler.
    visitorStatus: v.optional(
      v.union(
        v.literal("preRegistered"),
        v.literal("checkedIn"),
        v.literal("checkedOut"),
        v.literal("expired"),
      ),
    ),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_email", ["email"])
    .index("by_card", ["cardNumber"])
    .index("by_tc", ["tcNo"])
    .index("by_visitor", ["isVisitor"])
    // Expiry cron: isVisitor=true ∧ isActive=true ∧ accessExpiresAt<=now (ISO-UTC sıralanabilir).
    .index("by_visitor_active_expiry", ["isVisitor", "isActive", "accessExpiresAt"]),

  checkInTokens: defineTable({
    employeeId: v.id("employees"),
    token: v.string(),
    expiresAt: v.string(),
    usedAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_token", ["token"])
    .index("by_employee", ["employeeId"]),

  employeeAuth: defineTable({
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    setupToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.string()),
    lastLogin: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_employee", ["employeeId"])
    .index("by_token", ["setupToken"]),

  employeeSessions: defineTable({
    employeeId: v.id("employees"),
    token: v.string(),
    expiresAt: v.string(),
    createdAt: v.string(),
    lastUsedAt: v.optional(v.string()),
  })
    .index("by_token", ["token"])
    .index("by_employee", ["employeeId"]),

  departments: defineTable({
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    parentId: v.optional(v.id("departments")),
    level: v.optional(v.number()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_parent", ["parentId"]),

  // ═══════ 3 · ERİŞİM TOPOLOJİSİ · BÖLGE / KAPI / OKUYUCU / CİHAZ ═════════
  zones: defineTable({
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    description: v.optional(v.string()),
    // DEPRECATED: panel↔bölge 1:1 bağı kaldırıldı. Bölge artık saf mantıksal alan;
    // bir bölge birden çok panel/cihaz barındırabilir. Kapının paneli artık
    // doors.deviceId'de tutulur. Bu alan migration ile temizleniyor; geriye kalan
    // eski kayıtlar için optional bırakıldı (yeni kod yazmaz/okumaz).
    ideDeviceId: v.optional(v.id("devices")),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_ide_device", ["ideDeviceId"]),

  doors: defineTable({
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    // Kapının bölgesi (mantıksal alan). Variant 1: panele bağlı kapılar panelin
    // bölgesini (device.zoneId) yansıtır; panel taşınınca eşitlenir.
    zoneId: v.optional(v.id("zones")),
    // Kapıyı kontrol eden fiziksel cihaz/panel (controller). IDE Smart panellerde
    // panel device'ı; tek-kapılı cihazlarda da bağlanabilir. Boşsa manuel kapı.
    deviceId: v.optional(v.id("devices")),
    location: v.optional(v.string()),
    doorCode: v.optional(v.string()),
    status: v.optional(v.string()),
    // IDE Smart aktüatör index'i (io_id 0–3). Diğer markalarda boş.
    ioId: v.optional(v.number()),
    // Kapıda fiziksel "kapı açıldı" sensörü var mı → panel ACTUATOR{ioId}.REQUIRE_SENSOR_ACTIVATION.
    // true = sensör onayı beklenir (1); false = pulse sensör beklemeden tamamlanır (0).
    // Boşsa panelin mevcut değerine dokunulmaz. Sensörsüz kapıda false yapılmazsa actuator "busy"de takılır.
    requireSensor: v.optional(v.boolean()),
    // Okuyucu (Wiegand giriş yüzü) — kapıyla 1:1. Boşsa UI door.name'den türetir.
    readerName: v.optional(v.string()),
    // Okuyucu yön etiketi (görsel). Boşsa ioId'den türetilir (0=entry,1=exit,diğer=both).
    readerDirection: v.optional(
      v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
    ),
    // Hikvision fiziksel kapı numarası (1..N). IDE Smart'ta boş (ioId kullanılır).
    // openDoor/setDoorParam ile tutarlı; boşsa 1 default.
    hikDoorNo: v.optional(v.number()),
    // Kapı durum planı (DoorStatusPlan) — mesai saatinde kapıyı otomatik açık/kapalı tutar.
    hikDoorStatusPlan: v.optional(
      v.object({
        enabled: v.boolean(),
        beginTime: v.string(), // "HH:MM:SS"
        endTime: v.string(),   // "HH:MM:SS"
        mode: v.union(v.literal("remainOpen"), v.literal("normal")),
      })
    ),
    // Doğrulama planı (VerifyWeekPlan) — saate göre doğrulama modunu değiştirir.
    hikVerifyPlan: v.optional(
      v.object({
        enabled: v.boolean(),
        beginTime: v.string(), // "HH:MM:SS"
        endTime: v.string(),   // "HH:MM:SS"
        verifyMode: v.string(), // "cardOrFace", "card", vb.
      })
    ),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_zone", ["zoneId"])
    .index("by_device", ["deviceId"]),

  /**
   * Okuyucu (kart/yüz tarama yüzü) — kapıyla N:1. Bir kapı 1..2 okuyucu taşır
   * (giriş + çıkış). Önceden okuyucu doors.readerName/readerDirection ile 1:1
   * modelleniyordu; o alanlar legacy fallback olarak korunur, yeni kayıtlar bu
   * tabloya yazılır. İzin modeli kapı bazlı kalır — okuyucular panele gönderilmez
   * (Hik event'i okuyucu no taşımaz; hikReaderNo şimdilik görsel/ileriye dönük).
   */
  readers: defineTable({
    // Sahip kapı (zorunlu). Cascade: kapı silinince okuyucuları da silinir.
    doorId: v.id("doors"),
    // door.deviceId denormalize — by_device sorgusu + readerStatus RBAC için.
    deviceId: v.optional(v.id("devices")),
    projectId: v.optional(v.id("projects")),
    zoneId: v.optional(v.id("zones")),
    name: v.string(),
    direction: v.union(v.literal("entry"), v.literal("exit"), v.literal("both")),
    // Hikvision fiziksel okuyucu index'i — kapı N için entry=2N-1, exit=2N.
    // Şu an sadece görsel/ileriye dönük; izin kapı bazlı olduğundan panele yazılmaz.
    hikReaderNo: v.optional(v.number()),
    // IDE Smart aktüatör index'i (door.ioId ile eşlenir) — son okuma çözümünde kullanılır.
    ioId: v.optional(v.number()),
    status: v.optional(v.string()), // "active" | "inactive"
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_door", ["doorId"])
    .index("by_device", ["deviceId"])
    .index("by_project", ["projectId"])
    .index("by_zone", ["zoneId"]),

  devices: defineTable({
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    zoneId: v.optional(v.id("zones")),
    doorId: v.optional(v.id("doors")),
    // Cihazın kontrol ettiği genel kapı/röle sayısı (marka bağımsız, 1–8). Formda
    // kapı seçimi yerine bu sayı girilir; kapılar ayrıca bölge altında yönetilir.
    doorCount: v.optional(v.number()),
    deviceType: v.optional(v.string()),
    deviceIp: v.optional(v.string()),
    deviceSerial: v.optional(v.string()),
    accessDirection: v.optional(
      v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
    ),
    status: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    description: v.optional(v.string()),
    lastSeen: v.optional(v.string()),
    deviceUsername: v.optional(v.string()),
    devicePassword: v.optional(v.string()),
    // Marka (Hikvision / generic / IDE Smart panel). Form akışını + alan setini belirler.
    brand: v.optional(
      v.union(v.literal("hikvision"), v.literal("other"), v.literal("ide_smart"))
    ),
    // IDE Smart panel entegrasyonu. Komutlar MQTT (Hetzner broker + bridge +
    // idePendingOperations kuyruğu) üzerinden iletilir; Convex panele doğrudan bağlanmaz.
    // Panel = bölge (zoneId); kapılar zone altındaki doors (ioId 0..N-1).
    ideUuid: v.optional(v.string()), // SYSTEM.UUID — event lookup + dst-id eşleşmesi
    ideUser: v.optional(v.string()), // panel kimliği (MQTT login token'ı için; örn "admin")
    idePassword: v.optional(v.string()), // panel şifresi (AUTH.USER1..5)
    ideHttpPort: v.optional(v.number()), // opsiyonel LAN yedeği (HTTPSERVER.PORT)
    ideDoorCount: v.optional(v.number()), // panel aktüatör/kapı sayısı (default 4)
    // Hik Device Gateway entegrasyonu
    hikDevIndex: v.optional(v.string()),
    ehomeID: v.optional(v.string()),
    ehomeKey: v.optional(v.string()),
    hikModel: v.optional(v.string()),
    // Hikvision transport:
    // - gateway: Convex -> Hik Device Gateway -> device (current cloud path)
    // - localBridge: Windows bridge polls Convex and talks to HCNetSDK on LAN
    hikTransport: v.optional(v.union(v.literal("gateway"), v.literal("localBridge"))),
    hikLastSeenAt: v.optional(v.number()),
    hikOfflineHint: v.optional(v.string()),
    // En son işlenen event'in serialNo'su — sonraki event'in frontSerialNo'su ile karşılaştırılır.
    // Eşleşmezse aradaki event'ler düşmüş demektir (Phase 5.2'de AcsEvent backfill).
    hikLastSerialNo: v.optional(v.number()),
    // Cihazdaki fiziksel kapı sayısı (Door/capabilities). Person RightPlan'ı
    // 1..N kapı için entry üretmek zorunda — eksik kapı reddedilir.
    hikDoorCount: v.optional(v.number()),
    // localBridge: panelin SDK portu (default 8000). Panel kullanıcı/şifresi
    // deviceUsername/devicePassword alanlarında tutulur (tek-yer yönetim modeli).
    hikPort: v.optional(v.number()),
    hikLastRebootAt: v.optional(v.number()),
    // AcsEvent backfill: son işlenen event'in serialNo'su (canlı hikLastSerialNo'yu kirletmez).
    hikBackfillCursor: v.optional(v.number()),
    // AcsEvent backfill: son başarılı run'ın epoch ms zamanı.
    hikLastBackfillAt: v.optional(v.number()),
    hikWorkStatus: v.optional(
      v.object({
        updatedAt: v.number(),
        doorStatus: v.optional(v.array(v.number())),
        magneticStatus: v.optional(v.array(v.number())),
        cardReaderOnlineStatus: v.optional(v.array(v.number())),
        batteryVoltage: v.optional(v.number()),
        powerSupplyStatus: v.optional(v.string()),
        raw: v.optional(v.string()),
      })
    ),
    apiToken: v.optional(v.string()),
    apiTokenCreatedAt: v.optional(v.string()),
    // adminDevices geri bağlantısı — claim ile oluşturulur, release ile temizlenir.
    adminDeviceId: v.optional(v.id("adminDevices")),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_zone", ["zoneId"])
    .index("by_device_serial", ["deviceSerial"])
    .index("by_device_ip", ["deviceIp"])
    .index("by_hik_dev_index", ["hikDevIndex"])
    .index("by_ehome_id", ["ehomeID"])
    .index("by_api_token", ["apiToken"])
    .index("by_ide_uuid", ["ideUuid"])
    .index("by_admin_device", ["adminDeviceId"]),

  /**
   * Bir LAN bridge kurulumunun kimliği. Tek-yer modelinde bridge EXE'ye yalnızca
   * bu token girilir; bridge bu token ile ait olduğu projedeki tüm localBridge
   * cihazlarını (IP/port/kullanıcı/şifre + bekleyen işler) /hik-bridge/roster'dan
   * çeker. Panel bilgileri artık bridge'de değil ngsplus'ta yönetilir.
   */
  hikBridges: defineTable({
    projectId: v.id("projects"),
    token: v.string(),
    name: v.optional(v.string()),
    lastSeenAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_project", ["projectId"]),

  // ═══════ 4 · ERİŞİM KURALLARI · GRUP BAĞLARI ══════════════════════════
  accessRules: defineTable({
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    targetType: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    days: v.optional(v.array(v.string())),
    hikWeekPlanNo: v.optional(v.number()),
    // IDE Smart permission record id (1–65535). hikWeekPlanNo analogu, ayrı namespace.
    idePermissionNo: v.optional(v.number()),
    priority: v.optional(v.number()),
    accessDirection: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    isTemplate: v.optional(v.boolean()),
    templateName: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  groupMembers: defineTable({
    groupId: v.id("accessRules"),
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
    createdAt: v.string(),
  })
    .index("by_group", ["groupId"])
    .index("by_employee", ["employeeId"])
    .index("by_project_employee", ["projectId", "employeeId"])
    .index("by_project_group", ["projectId", "groupId"]),

  groupDevices: defineTable({
    groupId: v.id("accessRules"),
    deviceId: v.id("devices"),
    projectId: v.optional(v.id("projects")),
    createdAt: v.string(),
  })
    .index("by_group", ["groupId"])
    .index("by_device", ["deviceId"])
    .index("by_project_device", ["projectId", "deviceId"])
    .index("by_project_group", ["projectId", "groupId"]),

  // Kural × kapı (groupDevices'ın kapı granülaritesi). Bir kuralda belirli kapılar
  // seçildiğinde IDE permission.io o kuralın bu panele ait kapılarının ioId'lerinden türer.
  // Bir kuralın bir panel için hiç kaydı yoksa → panelin tüm kapıları (geriye uyumlu).
  groupDoors: defineTable({
    groupId: v.id("accessRules"),
    doorId: v.id("doors"),
    deviceId: v.optional(v.id("devices")),
    projectId: v.optional(v.id("projects")),
    createdAt: v.string(),
  })
    .index("by_group", ["groupId"])
    .index("by_door", ["doorId"])
    .index("by_project_group", ["projectId", "groupId"]),

  // ═══════ 5 · KART OKUMA · CİHAZ İŞ KUYRUKLARI ═════════════════════════
  cardReadings: defineTable({
    projectId: v.optional(v.id("projects")),
    deviceId: v.optional(v.id("devices")),
    employeeId: v.optional(v.id("employees")),
    cardNo: v.string(),
    employeeName: v.optional(v.string()),
    accessTime: v.string(),
    accessStatus: v.optional(
      v.union(v.literal("izin_verildi"), v.literal("reddedildi"))
    ),
    direction: v.optional(
      v.union(v.literal("entry"), v.literal("exit"))
    ),
    // IDE Smart panel: hangi aktüatör/kapıdan (io_id) okundu. Okuyucu-bazlı
    // canlı son-okuma için gerekli. deviceId panel cihazını tanımlar.
    ideIoId: v.optional(v.number()),
    rawData: v.optional(v.string()),
    // Hikvision event detayları (Device Gateway / ISAPI event push)
    hikMajorEventType: v.optional(v.number()),
    hikSubEventType: v.optional(v.number()),
    hikCurrentVerifyMode: v.optional(v.string()),
    hikSerialNo: v.optional(v.number()),
    hikFrontSerialNo: v.optional(v.number()),
    hikDevIndex: v.optional(v.string()),
    hikPictureURL: v.optional(v.string()),
    hikDateTime: v.optional(v.string()),
    hikMask: v.optional(v.string()),
    hikHelmet: v.optional(v.string()),
    hikTemperature: v.optional(v.number()),
    hikEventState: v.optional(v.string()),
    // Reddedildi ise spesifik neden (UI'da "Reddedildi (Yetki yok)" gibi).
    hikDenialReason: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_device", ["deviceId"])
    .index("by_employee", ["employeeId"])
    .index("by_access_time", ["accessTime"])
    .index("by_employee_device_time", ["employeeId", "deviceId", "accessTime"])
    .index("by_device_io_time", ["deviceId", "ideIoId", "accessTime"])
    .index("by_device_hik_serial", ["deviceId", "hikSerialNo"]),

  // Cihaz offline iken biriken Convex -> cihaz komutları kuyruğu.
  // Gateway cihazlarda worker failed kayıtları retry eder; localBridge cihazlarda
  // Windows bridge pending kayıtları claim edip SDK ile panele uygular.
  hikPendingOperations: defineTable({
    projectId: v.optional(v.id("projects")),
    deviceId: v.id("devices"),
    operation: v.union(
      v.literal("addPerson"),
      v.literal("updatePerson"),
      v.literal("deletePerson"),
      v.literal("addCard"),
      v.literal("deleteCard"),
      v.literal("addFace"),
      v.literal("deleteFace"),
      v.literal("addFingerprint"),
      v.literal("deleteFingerprint"),
      v.literal("syncWeekPlan"),
      v.literal("syncHoliday"),
      v.literal("syncDoorParam"),
      v.literal("openDoor"),
      v.literal("rebootDevice"),
      v.literal("syncDoorStatusPlan"),
      v.literal("syncVerifyPlan"),
      // NOT: IDE Smart komutları Faz 1'de anlık (action) çalışır, kuyruğa girmez.
      // Faz 2'de offline retry kuyruğu eklenecekse buraya ide* op literal'leri +
      // worker case'leri + recordSyncFailure union'ı birlikte eklenmeli.
    ),
    /**
     * Operation-spesifik payload. Şekil:
     * - addPerson/updatePerson/deletePerson/addCard/deleteCard: { employeeId, cardNumber? }
     * - addFace/deleteFace: { employeeId, faceStorageId? }
     * - addFingerprint/deleteFingerprint: { employeeId, fingerPrintID }
     * - syncWeekPlan: { accessRuleId, weekPlanNo }
     * - syncHoliday: { holidayGroupNo, accessRuleId? }
     * - syncDoorParam: { doorNo, param: { openDuration?, magneticAlarmEnable? } }
     * - openDoor: { doorNo }
     */
    payload: v.any(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("failed"),
    ),
    attemptCount: v.number(),
    /** Bir sonraki retry için epoch ms. pending status için worker bu eşiği bekler. */
    nextRetryAt: v.optional(v.number()),
    /** localBridge claim zamanı. Stuck processing kayıtları bununla geri pending yapılır. */
    processingStartedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    /**
     * Bu op'u claim eden bridge. Aynı projede iki bridge token varsa, B bridge'i
     * A'nın claim ettiği op'u ack edemesin (cross-bridge çift-uygulama sinyali).
     * Stale-requeue bunu temizler; yeni claim yeniden damgalar.
     */
    claimedBy: v.optional(v.id("hikBridges")),
  })
    .index("by_device_status", ["deviceId", "status"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_status_nextRetry", ["status", "nextRetryAt"]),

  /**
   * IDE Smart bulut→panel komut kuyruğu. Convex serverless MQTT tutamaz; Hetzner'daki
   * ide-mqtt-bridge daemon bu kuyruğu /ide-bridge/poll ile çeker, broker'a publish eder,
   * panel response'unu msx-id ile /ide-bridge/ack'e bildirir.
   * (hikPendingOperations'ın MQTT eşdeğeri — ayrı tablo, op tipleri IDE'ye özgü.)
   */
  idePendingOperations: defineTable({
    projectId: v.optional(v.id("projects")),
    deviceId: v.id("devices"),
    opType: v.union(
      v.literal("openDoor"),
      v.literal("upsertUser"),
      v.literal("deleteUser"),
      v.literal("upsertPermission"),
      v.literal("deletePermission"),
      v.literal("triggerSync"),
      v.literal("parameterWrite"),
    ),
    /**
     * Bridge'in MQTT envelope üretmesi için materialize edilmiş alanlar.
     * Şekil (opType'a göre; hepsi bridge'in envelopeForOp'una geçer):
     * - openDoor:         { dstId, ioId, keep }
     * - upsertUser:       { dstId, mode:"create"|"update", userRecord:{id,start?,end?,status?,permissions?} }
     * - deleteUser:       { dstId, ideUserId }
     * - upsertPermission: { dstId, mode, permissionRecord:{id,io,schedule,...} }
     * - deletePermission: { dstId, ideId }
     * - triggerSync:      { dstId, reset }
     * - parameterWrite:   { dstId, parameterName, parameterRecord:{[name]:number|string} }
     */
    payload: v.any(),
    status: v.union(
      v.literal("pending"), // yazıldı, teslim girişimi yok
      v.literal("sent"), // bridge publish etti, panel ack bekleniyor
      v.literal("acked"), // panel result:"success" — terminal
      v.literal("failed"), // terminal hata (maxAttempts aşıldı / kalıcı red)
    ),
    /** Bridge'in ürettiği transaction msx-id — panel response correlation anahtarı. */
    msxId: v.optional(v.number()),
    /** (deviceId|opType|hedef) — aynı pending op'un çift insert'ini engeller. */
    idempotencyKey: v.string(),
    attempts: v.number(),
    maxAttempts: v.optional(v.number()),
    /** pending için: bridge bu eşikten önce çekmez (backoff). epoch ms. */
    nextRetryAt: v.optional(v.number()),
    /** "sent"e geçiş — ack timeout hesabı. epoch ms. */
    sentAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    responseMessage: v.optional(v.string()),
    createdAt: v.number(),
    ackedAt: v.optional(v.number()),
  })
    .index("by_device_status", ["deviceId", "status"])
    .index("by_status_nextRetry", ["status", "nextRetryAt"])
    .index("by_msx", ["deviceId", "msxId"])
    .index("by_idempotency", ["idempotencyKey"]),

  /**
   * IDE Smart panelinde GERÇEKTE bulunan kullanıcıların (kart) takibi.
   * Convex panele doğrudan bağlanamadığı için "panelde kim var?" sorusunu okuyamayız;
   * bunun yerine başarılı upsertUser/deleteUser ack'lerini burada işleyerek panel
   * roster'ının yansımasını tutarız (markAck). Kural güncellemede (reconcilePanelRosterIde)
   * "panelde olan − yetkili" farkını silmek için kullanılır → O(çıkarılan), 1000 kullanıcıda
   * tüm roster'ı taramaz. ideUuid bazlı: panel yeniden-claim edilse (device _id değişse) bile
   * aynı fiziksel panelin roster'ı korunur. cardNumber normalize edilir: String(Number(x))
   * (panel id'si sayısal; "0008219041" → "8219041").
   */
  idePanelUsers: defineTable({
    ideUuid: v.string(),
    deviceId: v.id("devices"),
    cardNumber: v.string(), // normalize: String(Number(employee.cardNumber))
    projectId: v.optional(v.id("projects")),
    syncedAt: v.number(),
  })
    .index("by_uuid", ["ideUuid"])
    .index("by_uuid_card", ["ideUuid", "cardNumber"]),

  // ═══════ 6 · BİYOMETRİ ════════════════════════════════════════════════
  // Çalışan başına yüz fotoğrafı (Convex storage). Tek kişi → tek yüz.
  // Cihaza yazılan kayıt için ayrı status field yok — hikPendingOperations queue tutar.
  employeeFaces: defineTable({
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
    pictureStorageId: v.id("_storage"),
    addedAt: v.number(),
  })
    .index("by_employee", ["employeeId"])
    .index("by_project", ["projectId"]),

  // Çalışan başına parmak izi şablonu — `fingerPrintID` (1-10) slot bazlı.
  // `fingerData` cihazdan capture edilen base64 şablon (cihaz-modeline özgü).
  employeeFingerprints: defineTable({
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
    fingerPrintID: v.number(), // 1-10
    fingerData: v.string(),    // base64 template
    fingerType: v.optional(v.string()), // "normalFP" | "duressFP" | ...
    addedAt: v.number(),
  })
    .index("by_employee", ["employeeId"])
    .index("by_employee_fingerprint", ["employeeId", "fingerPrintID"])
    .index("by_project", ["projectId"]),

  // ═══════ 7 · PDKS · ŞİRKET / POZİSYON / VARDİYA ═══════════════════════
  pdksRecords: defineTable({
    projectId: v.optional(v.id("projects")),
    employeeId: v.id("employees"),
    employeeFirstName: v.string(),
    employeeLastName: v.string(),
    date: v.string(),
    entryTime: v.optional(v.string()),
    exitTime: v.optional(v.string()),
    status: v.string(),
    manualEntry: v.optional(v.boolean()),
    manualNote: v.optional(v.string()),
    editedBy: v.optional(v.id("users")),
    editedAt: v.optional(v.number()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_employee", ["employeeId"])
    .index("by_date", ["date"])
    .index("by_employee_date", ["employeeId", "date"]),

  companies: defineTable({
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    address: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    website: v.optional(v.string()),
    currency: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  positions: defineTable({
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  shifts: defineTable({
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    startTime: v.string(),
    endTime: v.string(),
    breakStart: v.optional(v.string()),
    breakEnd: v.optional(v.string()),
    lateToleranceMinutes: v.optional(v.number()),
    earlyExitToleranceMinutes: v.optional(v.number()),
    overtimeStartToleranceMinutes: v.optional(v.number()),
    overtimeEnabled: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_project", ["projectId"]),

  shiftAssignments: defineTable({
    employeeId: v.id("employees"),
    shiftId: v.id("shifts"),
    projectId: v.optional(v.id("projects")),
    startDate: v.string(),
    endDate: v.string(),
    weekPattern: v.optional(v.array(v.string())),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_employee", ["employeeId"])
    .index("by_shift", ["shiftId"])
    .index("by_project", ["projectId"])
    .index("by_dates", ["startDate", "endDate"]),

  // ═══════ 8 · AYARLAR (GENEL / MAIL / BİLDİRİM) ════════════════════════
  generalSettings: defineTable({
    projectId: v.optional(v.id("projects")),
    companyName: v.string(),
    address: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    currency: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    darkMode: v.optional(v.boolean()),
    dateFormat: v.optional(v.string()),
    timezone: v.optional(v.string()),
    systemLanguage: v.optional(v.string()),
    workingDays: v.optional(v.array(v.string())),
    workingHoursStart: v.optional(v.string()),
    workingHoursEnd: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  mailSettings: defineTable({
    projectId: v.optional(v.id("projects")),
    smtpHost: v.optional(v.string()),
    smtpPort: v.optional(v.number()),
    smtpUsername: v.optional(v.string()),
    smtpPassword: v.optional(v.string()),
    smtpSecure: v.optional(v.boolean()),
    fromEmail: v.optional(v.string()),
    fromName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  notificationSettings: defineTable({
    projectId: v.optional(v.id("projects")),
    emailNotifications: v.optional(v.boolean()),
    systemNotifications: v.optional(v.boolean()),
    lateNotifications: v.optional(v.boolean()),
    reportNotifications: v.optional(v.boolean()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  // ═══════ 9 · CİHAZ HAVUZU · IDE VARSAYILANLARI · CHAT ═════════════════
  // IDE Smart panelleri için sistem geneli ortak varsayılanlar (singleton — proje
  // index'i yok, `.first()` ile okunur). Admin "UUID ile ekle" yaparken bu kimlik
  // cihaz satırına KOPYALANIR (bridge op-zamanı device.ideUser/idePassword okur).
  // Fiziksel cihaz envanteri — super_admin burada UUID ile kaydeder.
  // Projeye atama (claim) anında bu tablodan `devices` tablosuna taşınır.
  // `releaseDevice` cihazı `devices`'dan kaldırıp buraya geri koyar.
  adminDevices: defineTable({
    // IDE Smart paneller için SYSTEM.UUID; non-IDE cihazlarda kullanılmaz.
    ideUuid: v.optional(v.string()),
    // QR/Hikvision/diğer donanımlar için seri no.
    deviceSerial: v.optional(v.string()),
    name: v.string(),
    brand: v.optional(
      v.union(v.literal("ide_smart"), v.literal("hikvision"), v.literal("other"))
    ),
    ideUser: v.optional(v.string()),
    idePassword: v.optional(v.string()),
    ideHttpPort: v.optional(v.number()),
    ideDoorCount: v.optional(v.number()),
    lastSeen: v.optional(v.string()),
    // devices.create/createIdePanel ile otomatik oluşturuldu; cihaz silinince bu da silinir.
    createdFromDevice: v.optional(v.boolean()),
    // Projeye atandığında set edilir; clear olunca havuza geri döner.
    assignedDeviceId: v.optional(v.id("devices")),
    assignedProjectId: v.optional(v.id("projects")),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_ide_uuid", ["ideUuid"])
    .index("by_device_serial", ["deviceSerial"])
    .index("by_assigned_device", ["assignedDeviceId"]),

  ideDefaults: defineTable({
    ideUser: v.string(),
    idePassword: v.string(),
    ideDoorCount: v.optional(v.number()),
    updatedAt: v.string(),
  }),

  chatConversations: defineTable({
    projectId: v.optional(v.id("projects")),
    title: v.optional(v.string()),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        data: v.optional(v.any()),
      })
    ),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_project", ["projectId"]),

  // ═══════ 10 · İZİN · MESAİ · ÇALIŞMA AYARLARI ═════════════════════════
  leaves: defineTable({
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
    leaveType: v.union(
      v.literal("annual"),
      v.literal("sick"),
      v.literal("excuse"),
      v.literal("unpaid"),
      v.literal("parental"),
      v.literal("marriage"),
      v.literal("bereavement"),
      v.literal("paternity"),
      v.literal("lactation"),
      v.literal("compensatory")
    ),
    startDate: v.string(),
    endDate: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    approvedBy: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_employee", ["employeeId"])
    .index("by_project", ["projectId"])
    .index("by_status", ["status"])
    .index("by_dates", ["startDate", "endDate"]),

  leaveBalances: defineTable({
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
    leaveType: v.string(),
    year: v.number(),
    totalDays: v.number(),
    usedDays: v.number(),
    remainingDays: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_employee", ["employeeId"])
    .index("by_project", ["projectId"])
    .index("by_employee_year", ["employeeId", "year"]),

  workSettings: defineTable({
    projectId: v.optional(v.id("projects")),
    workStartTime: v.optional(v.string()),
    workEndTime: v.optional(v.string()),
    lunchBreakStart: v.optional(v.string()),
    lunchBreakEnd: v.optional(v.string()),
    maxLateMinutes: v.optional(v.number()),
    earlyExitToleranceMinutes: v.optional(v.number()),
    allowLateEntry: v.optional(v.boolean()),
    annualOvertimeLimitHours: v.optional(v.number()),
    overtimeMultiplier: v.optional(v.number()),
    overtimeStartToleranceMinutes: v.optional(v.number()),
    monthlyHoursBase: v.optional(v.number()),
    updatedAt: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  // ═══════ 11 · KVKK ONAYLARI · KULLANICI TERCİHLERİ ════════════════════
  employeeConsents: defineTable({
    employeeId: v.id("employees"),
    consentType: v.union(
      v.literal("biometric_face"),
      v.literal("biometric_fingerprint"),
      v.literal("card"),
      v.literal("photo"),
      // Ziyaretçi KVKK aydınlatma/açık rıza onayı (kayıt sırasında alınır).
      v.literal("visitor_kvkk"),
    ),
    grantedAt: v.string(),
    revokedAt: v.optional(v.string()),
    documentUrl: v.optional(v.string()),
    grantedBy: v.optional(v.id("users")),
    notes: v.optional(v.string()),
  })
    .index("by_employee", ["employeeId"])
    .index("by_employee_type", ["employeeId", "consentType"]),

  userPreferences: defineTable({
    userId: v.id("users"),
    key: v.string(),
    value: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_key", ["userId", "key"]),

  // ═══════ 12 · TATİL · MESAİ ORANLARI ══════════════════════════════════
  holidays: defineTable({
    projectId: v.optional(v.id("projects")),
    date: v.string(),
    name: v.string(),
    isHalfDay: v.optional(v.boolean()),
    type: v.optional(
      v.union(v.literal("national"), v.literal("religious"), v.literal("company")),
    ),
    createdAt: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_date", ["projectId", "date"])
    .index("by_date", ["date"]),

  overtimeRates: defineTable({
    projectId: v.optional(v.id("projects")),
    weekdayMultiplier: v.number(),
    weekendMultiplier: v.number(),
    holidayMultiplier: v.number(),
    nightShiftMultiplier: v.number(),
    nightShiftStart: v.string(),
    nightShiftEnd: v.string(),
    updatedAt: v.string(),
  }).index("by_project", ["projectId"]),

  // ═══════ 13 · SİSTEM · AUDIT / RAPOR / DAVET ══════════════════════════
  auditLog: defineTable({
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete")
    ),
    targetTable: v.string(),
    targetId: v.string(),
    oldValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    note: v.optional(v.string()),
    timestamp: v.number(),
    ipAddress: v.optional(v.string()),
  })
    .index("by_project_timestamp", ["projectId", "timestamp"])
    .index("by_target", ["targetTable", "targetId"])
    .index("by_user_timestamp", ["userId", "timestamp"]),

  reportScheduleSettings: defineTable({
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    reportType: v.string(),
    email: v.string(),
    enabled: v.boolean(),
    lastSentAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"]),

  // Kullanıcı davet sistemi - yetkili kullanıcılar projeye davet eder veya
  // mevcut kullanıcıya şifre sıfırlama maili gönderir (type === "reset")
  invites: defineTable({
    email: v.string(),
    token: v.string(),
    projectId: v.id("projects"),
    role: v.union(v.literal("project_admin"), v.literal("project_user")),
    type: v.optional(v.union(v.literal("invite"), v.literal("reset"))),
    createdBy: v.id("users"),
    expiresAt: v.string(),
    used: v.optional(v.boolean()),
    createdAt: v.string(),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"]),
});
