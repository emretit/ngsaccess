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
    setupToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }).index("email", ["email"]),

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
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_email", ["email"])
    .index("by_card", ["cardNumber"])
    .index("by_tc", ["tcNo"]),

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

  zones: defineTable({
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    description: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  doors: defineTable({
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    zoneId: v.optional(v.id("zones")),
    location: v.optional(v.string()),
    doorCode: v.optional(v.string()),
    status: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_zone", ["zoneId"]),

  devices: defineTable({
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    zoneId: v.optional(v.id("zones")),
    doorId: v.optional(v.id("doors")),
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
    // Marka (Hikvision / generic). Form akışını + alan setini belirler.
    brand: v.optional(v.union(v.literal("hikvision"), v.literal("other"))),
    // Hik Device Gateway entegrasyonu
    hikDevIndex: v.optional(v.string()),
    ehomeID: v.optional(v.string()),
    ehomeKey: v.optional(v.string()),
    hikModel: v.optional(v.string()),
    hikLastSeenAt: v.optional(v.number()),
    hikOfflineHint: v.optional(v.string()),
    // En son işlenen event'in serialNo'su — sonraki event'in frontSerialNo'su ile karşılaştırılır.
    // Eşleşmezse aradaki event'ler düşmüş demektir (Phase 5.2'de AcsEvent backfill).
    hikLastSerialNo: v.optional(v.number()),
    // Cihazdaki fiziksel kapı sayısı (Door/capabilities). Person RightPlan'ı
    // 1..N kapı için entry üretmek zorunda — eksik kapı reddedilir.
    hikDoorCount: v.optional(v.number()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_zone", ["zoneId"])
    .index("by_device_serial", ["deviceSerial"])
    .index("by_device_ip", ["deviceIp"])
    .index("by_hik_dev_index", ["hikDevIndex"])
    .index("by_ehome_id", ["ehomeID"]),

  accessRules: defineTable({
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    targetType: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    days: v.optional(v.array(v.string())),
    hikWeekPlanNo: v.optional(v.number()),
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
    .index("by_employee_device_time", ["employeeId", "deviceId", "accessTime"]),

  // Cihaz offline iken biriken Convex → cihaz komutları kuyruğu.
  // Worker (hikQueueWorker) `status=pending AND nextRetryAt<=now` olanları işler.
  // `recordSyncFailure` doğrudan `status=failed` yazar (worker tarafından retry edilmez).
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
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_device_status", ["deviceId", "status"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_status_nextRetry", ["status", "nextRetryAt"]),

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

  employeeConsents: defineTable({
    employeeId: v.id("employees"),
    consentType: v.union(
      v.literal("biometric_face"),
      v.literal("biometric_fingerprint"),
      v.literal("card"),
      v.literal("photo"),
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
