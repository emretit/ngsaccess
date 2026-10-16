import { describe, expect, it } from "vitest";
import { linkedCountLabel, projectDeletionBlockingTables, projectDeletionBlockers, projectDeletionCleanupTables, projectDeletionError, reportSchedulePayload, userProtectionError } from "./lib/adminGuards";

const change = { isSelf: false, isSuperAdmin: true, removesSuperAdmin: true, adminCount: 2, deleting: false };

describe("ADM-03 kullanıcı koruması", () => {
  it("son süper admin düşürülemez veya silinemez", () => {
    expect(userProtectionError({ ...change, adminCount: 1 })).toContain("son süper adminin rolü");
    expect(userProtectionError({ ...change, adminCount: 1, deleting: true })).toContain("son süper admin silinemez");
  });
  it("ikinci admin olsa da kendini düşürme ve silme engellenir", () => {
    expect(userProtectionError({ ...change, isSelf: true })).toBe("Kendi rolünüzü düşüremezsiniz");
    expect(userProtectionError({ ...change, isSelf: true, deleting: true })).toBe("Kendi hesabınızı silemezsiniz");
  });
  it("kendi rolünü korumaya ve başka admini yönetmeye izin verir", () => {
    expect(userProtectionError({ ...change, isSelf: true, removesSuperAdmin: false })).toBeNull();
    expect(userProtectionError(change)).toBeNull();
    expect(userProtectionError({ ...change, deleting: true })).toBeNull();
    expect(userProtectionError({ ...change, isSuperAdmin: false, adminCount: 0 })).toBeNull();
  });
});

describe("ADM-20 bağlı proje kayıtları", () => {
  it("boş proje için engel üretmez", () => {
    expect(linkedCountLabel(0, "cihaz")).toBeNull();
    expect(projectDeletionError([])).toBeNull();
  });
  it("yalnız ayar, üyelik ve denetim geçmişi olan proje silinebilir", () => {
    const counts = Object.fromEntries(projectDeletionCleanupTables.map((table) => [table, 1]));
    const blockers = projectDeletionBlockers({ ...counts, auditLog: 500 });
    expect(blockers).toEqual([]);
    expect(projectDeletionError(blockers)).toBeNull();
    expect(projectDeletionCleanupTables).toContain("userProjects");
    expect(projectDeletionCleanupTables).toContain("generalSettings");
    expect(projectDeletionCleanupTables).toContain("chatConversations");
    expect(projectDeletionCleanupTables).toContain("invites");
    expect(projectDeletionCleanupTables).not.toContain("auditLog");
  });
  it("personeli olan proje yalnız iş verisini açıklayarak engellenir", () => {
    const blockers = projectDeletionBlockers({ employees: 1, userProjects: 1, generalSettings: 1, auditLog: 10 });
    expect(blockers).toEqual(["1 personel"]);
    expect(projectDeletionError(blockers)).toContain("1 personel var");
    expect(projectDeletionError(blockers)).toContain("pasife alabilirsiniz");
  });
  it("tüm iş tabloları engeller; türetilmiş cihaz ve personel bağlantıları engellemez", () => {
    for (const { table, label } of projectDeletionBlockingTables) {
      expect(projectDeletionBlockers({ [table]: 101 })).toEqual([`en az 101 ${label}`]);
      expect(projectDeletionCleanupTables).not.toContain(table);
    }
    expect(projectDeletionBlockers({ employeeAuth: 1, idePanelUsers: 1, hikPendingOperations: 1, idePendingOperations: 1 })).toEqual([]);
  });
  it("bağlı kayıtların sayısını ve çözümü açıklar", () => {
    expect(projectDeletionError(["12 personel", "3 cihaz"]))
      .toContain("12 personel, 3 cihaz var; önce bunları taşıyın veya silin");
  });
  it("sınırlanmış sayımı kesin toplam diye sunmaz", () => {
    expect(linkedCountLabel(100, "personel")).toBe("100 personel");
    expect(linkedCountLabel(101, "personel")).toBe("en az 101 personel");
  });
});

describe("ADM-11 rapor zamanlaması", () => {
  it("gizli e-posta boşken kapatılabilir", () => {
    expect(reportSchedulePayload("sgk", "  ", false)).toEqual({ reportType: "sgk", email: "", enabled: false });
  });
  it("açarken e-posta ister ve adresi temizler", () => {
    expect(() => reportSchedulePayload("sgk", "  ", true)).toThrow("E-posta adresi girin");
    expect(reportSchedulePayload("sgk", " rapor@firma.com ", true).email).toBe("rapor@firma.com");
  });
});
