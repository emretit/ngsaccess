// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import schema from "../schema";
import { resolveDirection } from "./cardReadingProcess";
import { DEFAULT_FLEXIBLE } from "./pdksFlexible";
import { groupPdksWorkDays, pdksWorkDay } from "./pdksWorkDay";
import type { Doc } from "../_generated/dataModel";
const modules = import.meta.glob("../**/*.ts");

type ShiftSeed = Pick<Doc<"shifts">, "startTime" | "endTime" | "scheduleType" | "flexible" | "validWindow">;
const night: ShiftSeed = { startTime: "22:00", endTime: "06:00" };
const day: ShiftSeed = { startTime: "08:00", endTime: "17:00" };
const extendedDay: ShiftSeed = { startTime: "09:00", endTime: "18:00", validWindow: {
  checkInStart: "08:00", checkInEnd: "10:00", checkOutStart: "17:00", checkOutEnd: "02:00", checkOutEndDayOffset: 1,
} };
const flexible: ShiftSeed = { startTime: "00:00", endTime: "00:00", scheduleType: "flexible", flexible: { ...DEFAULT_FLEXIBLE, checkOutEnd: "06:00" } };

describe("both okuyucu vardiyaya bağlı yönü", () => {
  it.each([
    ["2026-06-01T09:00:00+03:00", "2026-06-02T09:00:00+03:00", "entry", { ...extendedDay, validWindow: { checkInStart: "08:00", checkInEnd: "10:00", checkOutStart: "17:00", checkOutEndDayOffset: 1, ...extendedDay.validWindow, checkOutEnd: "10:00" } }, "entry"],
    ["2026-06-01T09:00:00+03:00", "2026-06-02T01:00:00+03:00", "entry", extendedDay, "exit"],
    ["2026-06-01T09:00:00+03:00", "2026-06-02T02:00:00+03:00", "entry", extendedDay, "exit"],
    ["2026-06-01T09:00:00+03:00", "2026-06-02T02:01:00+03:00", "entry", extendedDay, "entry"],
    ["2026-06-01T18:00:00+03:00", "2026-06-02T01:00:00+03:00", "exit", extendedDay, "entry"],
    ["2026-06-01T22:00:00+03:00", "2026-06-02T06:00:00+03:00", "entry", night, "exit"],
    ["2026-06-01T22:00:00+03:00", "2026-06-02T06:00:00+03:00", "entry", undefined, "entry"],
    ["2026-06-01T22:00:00+03:00", "2026-06-02T08:00:00+03:00", "entry", day, "entry"],
    ["2026-06-01T16:00:00+03:00", "2026-06-02T07:00:00+03:00", "entry", day, "entry"],
    ["2026-06-01T22:00:00+03:00", "2026-06-02T13:00:00+03:00", "entry", night, "entry"],
    ["2026-06-01T22:00:00+03:00", "2026-06-02T10:00:00+03:00", "entry", night, "exit"],
    ["2026-06-01T22:00:00+03:00", "2026-06-02T10:00:01+03:00", "entry", night, "entry"],
    ["2026-06-01T22:00:00+03:00", "2026-06-03T06:00:00+03:00", "entry", night, "entry"],
    ["2026-06-01T22:00:00+03:00", "2026-06-02T06:00:00+03:00", "entry", flexible, "exit"],
    ["2026-06-01T22:00:00+03:00", "2026-06-02T10:00:01+03:00", "entry", flexible, "entry"],
    ["2026-06-01T22:00:00+03:00", "2026-06-02T06:00:00+03:00", "entry", { startTime: "bozuk", endTime: "06:00" }, "entry"],
    ["2026-06-01T22:00:00+03:00", "2026-06-02T06:00:00+03:00", "entry", { ...night, scheduleType: "flexible" }, "entry"],
    ["2026-06-01T22:00:00+03:00", "2026-06-02T06:00:00+03:00", "entry", { ...flexible, flexible: { ...DEFAULT_FLEXIBLE, checkOutEndDayOffset: 0 } }, "entry"],
    ["2026-06-01T08:00:00+03:00", "2026-06-01T23:59:59+03:00", "entry", undefined, "exit"],
    ["2026-06-01T00:00:00+03:00", "2026-06-01T23:59:59+03:00", "entry", undefined, "exit"],
    ["2026-06-01T08:00:00+03:00", "2026-06-01T08:00:30+03:00", "entry", undefined, "exit"],
    ["2026-06-01T08:00:00+03:00", "2026-06-01T08:00:30+03:00", "exit", undefined, "entry"],
  ] as const)("%s → %s (%s) = %s", async (lastTime, nowISO, direction, shiftSeed, expected) => {
    for (const accessDirection of ["both", undefined] as const) {
      const t = convexTest(schema, modules);
      await t.run(async ctx => {
        const projectId = await ctx.db.insert("projects", { name: "Test" });
        const deviceId = await ctx.db.insert("devices", { projectId, name: "Okuyucu", accessDirection, createdAt: "", updatedAt: "" });
        const shiftId = shiftSeed ? await ctx.db.insert("shifts", { ...shiftSeed, projectId, name: "Vardiya", createdAt: "", updatedAt: "" }) : undefined;
        const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Test", lastName: "Kişi", email: "test@example.com", cardNumber: "123", isActive: true });
        await ctx.db.insert("cardReadings", { projectId, employeeId, deviceId, cardNo: "123", accessTime: new Date(lastTime).toISOString(), direction, accessStatus: "izin_verildi" });
        // Reddedilen olay başarılı oturumu sıfırlamaz.
        await ctx.db.insert("cardReadings", { projectId, employeeId, deviceId, cardNo: "123", accessTime: new Date(nowISO).toISOString(), direction: "exit", accessStatus: "reddedildi" });
        const device = await ctx.db.get(deviceId);
        const querySpy = vi.spyOn(ctx.db, "query");
        expect(await resolveDirection(ctx, { device, employeeId, nowISO })).toBe(expected);
        if (lastTime.slice(0, 10) === nowISO.slice(0, 10) || direction !== "entry") {
          expect(querySpy.mock.calls.map(args => args[0])).toEqual(["cardReadings"]);
        }
        querySpy.mockRestore();
        expect(await resolveDirection(ctx, { device: device ? { ...device, accessDirection: "entry" } : null, employeeId, nowISO })).toBe("entry");
        expect(await resolveDirection(ctx, { device: device ? { ...device, accessDirection: "exit" } : null, employeeId, nowISO })).toBe("exit");
        for (const [ideIoId, physical] of [[0, "entry"], [1, "exit"]] as const) {
          expect(await resolveDirection(ctx, { device: device ? { ...device, brand: "ide_smart", accessDirection: physical === "entry" ? "exit" : "entry" } : null, employeeId, nowISO, ideIoId })).toBe(physical);
        }
      });
    }
  });

  it.each([["09:00", "exit"], ["12:00", "entry"]] as const)("N3-01: today's dated shift decides overlap at %s", async (time, expected) => {
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
      const projectId = await ctx.db.insert("projects", { name: "Test" });
      const deviceId = await ctx.db.insert("devices", { projectId, name: "Cihaz", accessDirection: "both", createdAt: "", updatedAt: "" });
      const previousId = await ctx.db.insert("shifts", { projectId, name: "Dün", ...extendedDay, validWindow: { checkInStart: "08:00", checkInEnd: "10:00", checkOutStart: "17:00", checkOutEnd: "14:00", checkOutEndDayOffset: 1 }, createdAt: "", updatedAt: "" });
      const currentId = await ctx.db.insert("shifts", { projectId, name: "Bugün", startTime: "12:00", endTime: "20:00", validWindow: { checkInStart: "11:00", checkInEnd: "13:00", checkOutStart: "19:00", checkOutEnd: "21:00", checkOutEndDayOffset: 0 }, createdAt: "", updatedAt: "" });
      const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Test", lastName: "Kişi", email: "test@example.test", cardNumber: "123", isActive: true });
      for (const [date, shiftId] of [["2026-06-01", previousId], ["2026-06-02", currentId]] as const) await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: date, endDate: date, createdAt: "", updatedAt: "" });
      await ctx.db.insert("cardReadings", { projectId, employeeId, deviceId, cardNo: "123", accessTime: "2026-06-01T06:00:00.000Z", direction: "entry", accessStatus: "izin_verildi" });
      expect(await resolveDirection(ctx, { device: await ctx.db.get(deviceId), employeeId, nowISO: `2026-06-02T${time}:00+03:00` })).toBe(expected);
    });
  });

  it("PDK-007: tarihli gündüz çıkış penceresi açık oturumu önceki iş gününde kapatır", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
      const projectId = await ctx.db.insert("projects", { name: "Test" });
      const deviceId = await ctx.db.insert("devices", { projectId, name: "Cihaz", accessDirection: "both", createdAt: "", updatedAt: "" });
      // Today's definition no longer crosses midnight; yesterday's snapshot does.
      const shiftId = await ctx.db.insert("shifts", { ...day, projectId, name: "Gündüz", versionedUntil: "2026-06-01", createdAt: "", updatedAt: "" });
      await ctx.db.insert("shiftVersions", { shiftId, validUntil: "2026-06-01", rules: extendedDay, createdAt: "" });
      const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Test", lastName: "Kişi", email: "test@example.com", cardNumber: "123", isActive: true });
      await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-06-01", endDate: "2026-06-02", createdAt: "", updatedAt: "" });
      const entry = { accessTime: "2026-06-01T06:00:00.000Z", direction: "entry" as const };
      await ctx.db.insert("cardReadings", { ...entry, projectId, employeeId, deviceId, cardNo: "123", accessStatus: "izin_verildi" });
      const accessTime = "2026-06-01T22:00:00.000Z"; // June 2, 01:00 in Turkey
      const direction = await resolveDirection(ctx, { device: await ctx.db.get(deviceId), employeeId, nowISO: accessTime });
      expect(direction).toBe("exit");
      const current = await ctx.db.get(shiftId);
      if (!current) throw new Error("Vardiya bulunamadı");
      const resolve = (_id: typeof employeeId, date: string) => date === "2026-06-01" ? { ...current, ...extendedDay } : current;
      expect(pdksWorkDay(accessTime, employeeId, resolve, direction)).toBe("2026-06-01");
      const grouped = groupPdksWorkDays([entry, { accessTime, direction }], employeeId, resolve);
      expect([...grouped.keys()]).toEqual(["2026-06-01"]);
      expect(grouped.get("2026-06-01")).toHaveLength(2);
    });
  });

  it("cihaz değişiminde aynı proje oturumu korunur; yabancı proje ve başka çalışan dışlanır", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
      const projectId = await ctx.db.insert("projects", { name: "Test" });
      const foreignProjectId = await ctx.db.insert("projects", { name: "Başka" });
      const deviceId = await ctx.db.insert("devices", { projectId, name: "A", createdAt: "", updatedAt: "" });
      const secondDeviceId = await ctx.db.insert("devices", { projectId, name: "B", createdAt: "", updatedAt: "" });
      const shiftId = await ctx.db.insert("shifts", { ...night, projectId, name: "Gece", createdAt: "", updatedAt: "" });
      const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Test", lastName: "Kişi", email: "test@example.com", cardNumber: "123", isActive: true });
      const otherId = await ctx.db.insert("employees", { projectId, firstName: "Diğer", lastName: "Kişi", email: "other@example.com", cardNumber: "456", isActive: true });
      await ctx.db.insert("cardReadings", { projectId, employeeId, deviceId, cardNo: "123", accessTime: "2026-06-01T19:00:00Z", direction: "entry", accessStatus: "izin_verildi" });
      await ctx.db.insert("cardReadings", { projectId: foreignProjectId, employeeId, cardNo: "123", accessTime: "2026-06-02T01:00:00Z", direction: "exit", accessStatus: "izin_verildi" });
      await ctx.db.insert("cardReadings", { projectId, employeeId: otherId, deviceId: secondDeviceId, cardNo: "456", accessTime: "2026-06-02T02:00:00Z", direction: "exit", accessStatus: "izin_verildi" });
      expect(await resolveDirection(ctx, { device: await ctx.db.get(secondDeviceId), employeeId, nowISO: "2026-06-02T03:00:00Z" })).toBe("exit");
    });
  });

  it("giriş günündeki atama ve hafta deseni kullanılır; güncel gündüz vardiyası geceyi bozmaz", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
      const projectId = await ctx.db.insert("projects", { name: "Test" });
      const deviceId = await ctx.db.insert("devices", { projectId, name: "A", createdAt: "", updatedAt: "" });
      const dayId = await ctx.db.insert("shifts", { ...day, projectId, name: "Gündüz", createdAt: "", updatedAt: "" });
      const nightId = await ctx.db.insert("shifts", { ...night, projectId, name: "Gece", createdAt: "", updatedAt: "" });
      const employeeId = await ctx.db.insert("employees", { projectId, shiftId: dayId, firstName: "Test", lastName: "Kişi", email: "test@example.com", cardNumber: "123", isActive: true });
      await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId: nightId, startDate: "2026-06-01", endDate: "2026-06-01", weekPattern: ["MON"], createdAt: "", updatedAt: "" });
      await ctx.db.insert("cardReadings", { projectId, employeeId, deviceId, cardNo: "123", accessTime: "2026-06-01T19:00:00Z", direction: "entry", accessStatus: "izin_verildi" });
      expect(await resolveDirection(ctx, { device: await ctx.db.get(deviceId), employeeId, nowISO: "2026-06-02T03:00:00Z" })).toBe("exit");
      // Sınırdan fazla aday atama olduğunda belirsiz gece çıkışı üretilmez.
      for (let i = 0; i < 100; i++) await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId: nightId, startDate: "2026-06-01", endDate: "2026-06-01", createdAt: "", updatedAt: "" });
      expect(await resolveDirection(ctx, { device: await ctx.db.get(deviceId), employeeId, nowISO: "2026-06-02T03:00:00Z" })).toBe("entry");
    });
  });
});
