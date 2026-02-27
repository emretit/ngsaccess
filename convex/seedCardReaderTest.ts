/**
 * Tek seferlik seed: Kart okuyucu testi için cihaz + çalışan + erişim grubu.
 * Convex Dashboard → Functions → seedCardReaderTest.run → Run (args: {}) ile çalıştır.
 * Veya uygulama üzerinden Cihaz/Çalışan/Erişim kuralı ekleyebilirsiniz (docs/CIHAZ_CALISAN_ERISIM_EKLEME.md).
 */
import { internalMutation } from "./_generated/server";

const DEVICE_IP = "192.168.1.212";
const DEVICE_SERIAL = "DS-K1T343MFWX20240702V032100ENFT9649880";
const CARD_NO = "0108489849";

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();

    let projectId = (await ctx.db.query("projects").first())?._id;
    if (!projectId) {
      projectId = await ctx.db.insert("projects", {
        name: "Test Projesi",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const existingDevice = await ctx.db
      .query("devices")
      .withIndex("by_device_serial", (q) => q.eq("deviceSerial", DEVICE_SERIAL))
      .first();
    let deviceId = existingDevice?._id;
    if (!deviceId) {
      deviceId = await ctx.db.insert("devices", {
        name: "Hikvision Kart Okuyucu (192.168.1.212)",
        projectId,
        deviceType: "access_control",
        deviceIp: DEVICE_IP,
        deviceSerial: DEVICE_SERIAL,
        isActive: true,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    const existingEmployee = await ctx.db
      .query("employees")
      .withIndex("by_card", (q) => q.eq("cardNumber", CARD_NO))
      .first();
    let employeeId = existingEmployee?._id;
    if (!employeeId) {
      employeeId = await ctx.db.insert("employees", {
        projectId,
        firstName: "Test",
        lastName: "Kullanıcı",
        email: "test-kart@test.com",
        tcNo: "12345678901",
        cardNumber: CARD_NO,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const existingRule = await ctx.db
      .query("accessRules")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    let ruleId = existingRule?._id;
    if (!ruleId) {
      ruleId = await ctx.db.insert("accessRules", {
        name: "Kart Okuyucu Test Grubu",
        projectId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", ruleId))
      .collect();
    const hasMember = members.some((m) => m.employeeId === employeeId);
    if (!hasMember) {
      await ctx.db.insert("groupMembers", {
        groupId: ruleId,
        employeeId,
        projectId,
        createdAt: now,
      });
    }

    const hasDevice = await ctx.db
      .query("groupDevices")
      .withIndex("by_group", (q) => q.eq("groupId", ruleId))
      .filter((q) => q.eq(q.field("deviceId"), deviceId))
      .first();
    if (!hasDevice) {
      await ctx.db.insert("groupDevices", {
        groupId: ruleId,
        deviceId,
        projectId,
        createdAt: now,
      });
    }

    // Önceki loglardan örnek kart okutma kayıtları ekle (test/gösterim için)
    const existingReadings = await ctx.db
      .query("cardReadings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .take(5);
    if (existingReadings.length === 0) {
      const sampleTimes = [
        new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      ];
      for (let i = 0; i < sampleTimes.length; i++) {
        await ctx.db.insert("cardReadings", {
          projectId,
          deviceId,
          employeeId,
          cardNo: CARD_NO,
          employeeName: "Test Kullanıcı",
          accessTime: sampleTimes[i],
          accessStatus: i < 3 ? "izin_verildi" : "reddedildi",
          createdAt: sampleTimes[i],
          updatedAt: sampleTimes[i],
        });
      }
    }

    const addedReadings = existingReadings.length === 0 ? 5 : 0;
    return {
      ok: true,
      projectId,
      deviceId,
      employeeId,
      ruleId,
      message: addedReadings > 0
        ? `Cihaz, çalışan ve erişim grubu hazır. ${addedReadings} adet örnek kart okutma kaydı eklendi. Kart Okutma Geçmişi sayfasında görüntüleyebilirsiniz.`
        : "Cihaz, çalışan ve erişim grubu hazır. Kart 0108489849 ile cihazda okutmayı deneyin.",
    };
  },
});
