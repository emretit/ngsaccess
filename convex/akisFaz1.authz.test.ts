// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Doc } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
const date = "2026-10-20";
const range = { startDate: date, endDate: date };
async function fixture(role: Doc<"users">["role"] = "project_admin", foreign = false) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Yetkili proje" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Diğer proje" });
    const userId = await ctx.db.insert("users", { role, name: "Yönetici", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId: foreign ? otherProjectId : projectId });
    const zoneId = await ctx.db.insert("zones", { projectId, name: "Bölge", createdAt: "", updatedAt: "" });
    const emptyZoneId = await ctx.db.insert("zones", { projectId, name: "Boş bölge", createdAt: "", updatedAt: "" });
    const otherZoneId = await ctx.db.insert("zones", { projectId: otherProjectId, name: "Diğer bölge", createdAt: "", updatedAt: "" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Cihaz", createdAt: "", updatedAt: "" });
    const otherDeviceId = await ctx.db.insert("devices", { projectId: otherProjectId, name: "Diğer cihaz", createdAt: "", updatedAt: "" });
    const doorId = await ctx.db.insert("doors", { projectId, zoneId, deviceId, name: "Kapı", ioId: 0, createdAt: "", updatedAt: "" });
    const secondDoorId = await ctx.db.insert("doors", { projectId, deviceId, name: "İkinci kapı", createdAt: "", updatedAt: "" });
    const readerId = await ctx.db.insert("readers", { projectId, deviceId, doorId, name: "Okuyucu", direction: "entry", createdAt: "", updatedAt: "" });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Kural", isActive: true, createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "LOCAL", isActive: true });
    const otherEmployeeId = await ctx.db.insert("employees", { projectId: otherProjectId, firstName: "Diğer", lastName: "Kişi", email: "other@example.test", cardNumber: "FOREIGN", isActive: true });
    const holidayId = await ctx.db.insert("holidays", { projectId, date, name: "Yerel", isHalfDay: false, createdAt: "" });
    const otherHolidayId = await ctx.db.insert("holidays", { projectId: otherProjectId, date, name: "Diğer", isHalfDay: false, createdAt: "" });
    const globalHolidayId = await ctx.db.insert("holidays", { date, name: "Global", isHalfDay: false, createdAt: "" });
    return { projectId, otherProjectId, userId, sessionId, zoneId, emptyZoneId, otherZoneId, deviceId, otherDeviceId, doorId, secondDoorId, readerId, ruleId, employeeId, otherEmployeeId, holidayId, otherHolidayId, globalHolidayId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function targetState(f: Fixture) {
  return await f.t.run(async ctx => ({
    rules: await ctx.db.query("accessRules").collect(),
    doors: await ctx.db.query("doors").collect(),
    zones: await ctx.db.query("zones").collect(),
    readers: await ctx.db.query("readers").collect(),
    holidays: await ctx.db.query("holidays").collect(),
    employees: await ctx.db.query("employees").collect(),
    pdksRecords: await ctx.db.query("pdksRecords").collect(),
    audit: await ctx.db.query("auditLog").collect(),
  }));
}
async function expectRejectedUnchanged(f: Fixture, run: () => Promise<unknown>, message: string | RegExp) {
  const before = await targetState(f);
  await expect(run()).rejects.toThrow(message);
  expect(await targetState(f)).toEqual(before);
}
const emptyDiff = { employees: { added: [], removed: [] }, devices: { added: [], removed: [] }, doors: { added: [], removed: [] } };
const writes: { name: string; run: (f: Fixture) => Promise<unknown> }[] = [
  { name: "accessRules.create", run: f => f.caller.mutation(api.accessRules.create, { projectId: f.projectId, name: "Yeni", days: ["Monday"] }) },
  { name: "accessRules.update", run: f => f.caller.mutation(api.accessRules.update, { ruleId: f.ruleId, name: "Yeni" }) },
  { name: "accessRules.remove", run: f => f.caller.mutation(api.accessRules.remove, { ruleId: f.ruleId }) },
  { name: "accessRules.createWithGroups", run: f => f.caller.mutation(api.accessRules.createWithGroups, { projectId: f.projectId, name: "Yeni", days: ["Monday"] }) },
  { name: "accessRules.updateWithGroups", run: f => f.caller.mutation(api.accessRules.updateWithGroups, { ruleId: f.ruleId, name: "Yeni" }) },
  { name: "accessRules.updateWithGroupsTracked", run: f => f.caller.mutation(api.accessRules.updateWithGroupsTracked, { ruleId: f.ruleId, name: "Yeni", relationDiff: emptyDiff }) },
  { name: "doors.create", run: f => f.caller.mutation(api.doors.create, { projectId: f.projectId, zoneId: f.zoneId, deviceId: f.deviceId, name: "Yeni" }) },
  { name: "doors.update", run: f => f.caller.mutation(api.doors.update, { doorId: f.doorId, name: "Yeni", deviceId: f.deviceId }) },
  { name: "doors.remove", run: f => f.caller.mutation(api.doors.remove, { doorId: f.doorId }) },
  { name: "zones.create", run: f => f.caller.mutation(api.zones.create, { projectId: f.projectId, name: "Yeni" }) },
  { name: "zones.remove", run: f => f.caller.mutation(api.zones.remove, { zoneId: f.emptyZoneId }) },
  { name: "readers.create", run: f => f.caller.mutation(api.readers.create, { doorId: f.secondDoorId, name: "Yeni", direction: "entry" }) },
  { name: "readers.move", run: f => f.caller.mutation(api.readers.move, { readerId: f.readerId, targetDoorId: f.secondDoorId, direction: "entry" }) },
  { name: "readers.update", run: f => f.caller.mutation(api.readers.update, { readerId: f.readerId, name: "Yeni" }) },
  { name: "readers.remove", run: f => f.caller.mutation(api.readers.remove, { readerId: f.readerId }) },
  { name: "holidays.create", run: f => f.caller.mutation(api.holidays.create, { projectId: f.projectId, date: "2026-10-21", name: "Yeni" }) },
  { name: "holidays.remove", run: f => f.caller.mutation(api.holidays.remove, { id: f.holidayId }) },
  { name: "holidays.seedTurkishHolidays", run: f => f.caller.mutation(api.holidays.seedTurkishHolidays, { projectId: f.projectId, years: [2026] }) },
];
describe.each(writes)("$name sunucu yetkisi", operation => {
  it("project_user reddedilir", async () => {
    const f = await fixture("project_user");
    await expectRejectedUnchanged(f, () => operation.run(f), "yetkiniz yok");
  });
  it("başka projenin admin'i reddedilir", async () => {
    const f = await fixture("project_admin", true);
    await expectRejectedUnchanged(f, () => operation.run(f), /yetkiniz yok/);
  });
  it("kendi projesinin admin'i başarır", async () => {
    await expect(operation.run(await fixture())).resolves.not.toThrow();
  });
  it("super_admin başarır", async () => {
    await expect(operation.run(await fixture("super_admin"))).resolves.not.toThrow();
  });
});

describe("kapı cihaz ve okuyucu proje tutarlılığı", () => {
  it.each(["project_admin", "super_admin"] as const)("%s başka projenin cihazını create/update ile bağlayamaz", async role => {
    const f = await fixture(role);
    if (role === "project_admin") await f.t.run(ctx => ctx.db.insert("userProjects", { userId: f.userId, projectId: f.otherProjectId }));
    await expectRejectedUnchanged(f, () => f.caller.mutation(api.doors.create, { projectId: f.projectId, zoneId: f.zoneId, deviceId: f.otherDeviceId, name: "Yanlış" }), "projesinde değil");
    await expectRejectedUnchanged(f, () => f.caller.mutation(api.doors.update, { doorId: f.doorId, deviceId: f.otherDeviceId }), "projesinde değil");
    await expectRejectedUnchanged(f, () => f.caller.mutation(api.doors.update, { doorId: f.doorId, zoneId: f.otherZoneId, deviceId: f.otherDeviceId }), /yetki|projesinde değil/);
    expect((await f.t.run(ctx => ctx.db.get(f.doorId)))?.deviceId).toBe(f.deviceId);
  });
  it("silinmiş cihazı create/update reddeder", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.delete(f.otherDeviceId));
    await expectRejectedUnchanged(f, () => f.caller.mutation(api.doors.create, { projectId: f.projectId, deviceId: f.otherDeviceId, name: "Yok" }), "bulunamadı");
    await expectRejectedUnchanged(f, () => f.caller.mutation(api.doors.update, { doorId: f.doorId, deviceId: f.otherDeviceId }), "bulunamadı");
  });
  it.each(["panel", "readerProject", "readerDevice", "reading", "employee", "fallback"] as const)("%s tutarsızsa son kart/kişi gösterilmez", async bad => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.insert("cardReadings", { projectId: bad === "reading" ? f.otherProjectId : f.projectId, deviceId: bad === "panel" || bad === "fallback" ? f.otherDeviceId : f.deviceId,
        employeeId: bad === "employee" ? f.otherEmployeeId : f.employeeId, cardNo: "SECRET", employeeName: "Gizli kişi", accessTime: new Date().toISOString(), accessStatus: "izin_verildi", ideIoId: 0, createdAt: "", updatedAt: "" });
      if (bad === "panel") await ctx.db.patch(f.doorId, { deviceId: f.otherDeviceId });
      if (bad === "readerProject") await ctx.db.patch(f.readerId, { projectId: f.otherProjectId });
      if (bad === "readerDevice") await ctx.db.patch(f.readerId, { deviceId: f.otherDeviceId });
      if (bad === "fallback") {
        await ctx.db.patch(f.doorId, { deviceId: undefined, ioId: undefined });
        await ctx.db.patch(f.readerId, { deviceId: undefined });
        await ctx.db.patch(f.otherDeviceId, { doorId: f.doorId });
      }
    });
    const rows = await f.caller.query(api.doors.readerStatus, { projectId: f.projectId });
    expect(rows.find(row => row.readerId === f.readerId)).toMatchObject({ lastCardNo: null, lastEmployeeName: null });
  });
  it("tutarlı okuyucu kendi projesinin son okumasını gösterir", async () => {
    const f = await fixture("project_user");
    await f.t.run(ctx => ctx.db.insert("cardReadings", { projectId: f.projectId, deviceId: f.deviceId, employeeId: f.employeeId, cardNo: "LOCAL", employeeName: "Ada Test", accessTime: new Date().toISOString(), accessStatus: "izin_verildi", ideIoId: 0, createdAt: "", updatedAt: "" }));
    expect(await f.caller.query(api.doors.readerStatus, { projectId: f.projectId })).toContainEqual(expect.objectContaining({ readerId: f.readerId, lastCardNo: "LOCAL", lastEmployeeName: "Ada Test" }));
    expect(await f.caller.query(api.accessRules.list, { projectId: f.projectId })).toHaveLength(1);
  });
});

describe("tatil okumaları ve global yazımlar", () => {
  it.each(["project_user", "project_admin"] as const)("%s yalnız global ve izinli tatilleri okur", async role => {
    const f = await fixture(role);
    const names = (rows: { name: string }[]) => rows.map(row => row.name).sort();
    expect(names(await f.caller.query(api.holidays.list, {}))).toEqual(["Global", "Yerel"]);
    expect(names(await f.caller.query(api.holidays.listForRange, range))).toEqual(["Global", "Yerel"]);
    await expectRejectedUnchanged(f, () => f.caller.query(api.holidays.list, { projectId: f.otherProjectId }), /yetki|projesinde değil/);
    await expectRejectedUnchanged(f, () => f.caller.query(api.holidays.getOvertimeRates, { projectId: f.otherProjectId }), /yetki|projesinde değil/);
    await f.t.run(async ctx => {
      for (const row of await ctx.db.query("userProjects").collect()) await ctx.db.delete(row._id);
    });
    expect(names(await f.caller.query(api.holidays.listForRange, range))).toEqual(["Global"]);
  });
  it("super_admin tüm tatilleri okur", async () => {
    const f = await fixture("super_admin");
    expect(await f.caller.query(api.holidays.list, {})).toHaveLength(3);
    expect(await f.caller.query(api.holidays.listForRange, range)).toHaveLength(3);
  });
  for (const write of [
    { name: "create", run: (f: Fixture) => f.caller.mutation(api.holidays.create, { date: "2026-10-21", name: "Global yeni" }) },
    { name: "remove", run: (f: Fixture) => f.caller.mutation(api.holidays.remove, { id: f.globalHolidayId }) },
    { name: "seed", run: (f: Fixture) => f.caller.mutation(api.holidays.seedTurkishHolidays, { years: [2026] }) },
  ]) {
    it.each(["project_user", "project_admin", "super_admin"] as const)(`${write.name}: global yazım %s`, async role => {
      const f = await fixture(role);
      if (role === "super_admin") await write.run(f);
      else await expectRejectedUnchanged(f, () => write.run(f), /yetkiniz yok|yalnız süper admin/);
    });
  }
});

async function addPdksAudit(f: Fixture) {
  return await f.t.run(async ctx => {
    const recordId = await ctx.db.insert("pdksRecords", { projectId: f.projectId, employeeId: f.employeeId, employeeFirstName: "Ada", employeeLastName: "Test", date, status: "present", createdAt: "", updatedAt: "" });
    const values = { userId: f.userId, action: "update" as const, targetTable: "pdksRecords", timestamp: 1, newValue: { date } };
    await ctx.db.insert("auditLog", { ...values, projectId: f.projectId, targetId: recordId, note: "Çalışanın kaydı" });
    await ctx.db.insert("auditLog", { ...values, projectId: f.projectId, targetId: f.employeeId, note: "Çalışan hedefi" });
    for (const projectId of [undefined, f.otherProjectId, f.projectId]) await ctx.db.insert("auditLog", { ...values, projectId, targetId: "bulk-upsert", note: "Toplu özet" });
    await ctx.db.insert("auditLog", { ...values, projectId: f.otherProjectId, targetId: recordId, note: "Yanlış proje" });
    for (let i = 0; i < 510; i++) await ctx.db.insert("auditLog", { ...values, projectId: f.otherProjectId, targetId: "unrelated", timestamp: i + 10 });
    return recordId;
  });
}
describe("PDKS çalışan geçmişi", () => {
  it.each(["project_user", "project_admin"] as const)("yetkisiz %s reddedilir", async role => {
    const f = await fixture(role, role === "project_admin");
    await expectRejectedUnchanged(f, () => f.caller.query(api.auditLog.getPdksAuditForEmployee, { employeeId: f.employeeId, ...range }), /yetki|projesinde değil/);
  });
  it("kendi admin'i global son 500 dışında kalan kendi kayıtlarını görür", async () => {
    const f = await fixture();
    await addPdksAudit(f);
    const rows = await f.caller.query(api.auditLog.getPdksAuditForEmployee, { employeeId: f.employeeId, ...range });
    expect(rows.map(row => row.note).sort()).toEqual(["Çalışan hedefi", "Çalışanın kaydı"]);
    expect(await f.caller.query(api.auditLog.getPdksAuditForEmployee, { employeeId: f.employeeId, startDate: "2026-11-01", endDate: "2026-11-30" })).toEqual([]);
  });
  it.each(["project_admin", "super_admin"] as const)("%s tüm satırlar hatalıysa proje hata özeti yazar", async role => {
    const f = await fixture(role);
    const before = await f.t.run(ctx => ctx.db.query("pdksRecords").collect());
    const result = await f.caller.mutation(api.pdksRecords.bulkUpsertManual, {
      note: "Hatalı saat denemesi",
      rows: [f.employeeId, f.employeeId, f.otherEmployeeId].map(employeeId => ({ employeeId, date, entryTime: "25:00" })),
    });
    expect(result).toMatchObject({ inserted: 0, updated: 0, errors: expect.any(Array) });
    expect(result.errors).toHaveLength(3);
    expect(await f.t.run(ctx => ctx.db.query("pdksRecords").collect())).toEqual(before);
    const audit = await f.t.run(ctx => ctx.db.query("auditLog").collect());
    expect(audit).toHaveLength(role === "super_admin" ? 2 : 1);
    expect(audit.find(row => row.projectId === f.projectId)).toMatchObject({ targetId: "bulk-upsert", newValue: { inserted: 0, updated: 0, touched: 0, errors: 2 } });
    if (role === "super_admin") expect(audit.find(row => row.projectId === f.otherProjectId)?.newValue).toEqual({ inserted: 0, updated: 0, touched: 0, errors: 1 });
  });
  it.each(["missing", "foreign", "projectless"] as const)("%s çalışan için başarısız batch audit yazmaz", async kind => {
    const f = await fixture();
    if (kind === "missing") await f.t.run(ctx => ctx.db.delete(f.employeeId));
    if (kind === "projectless") await f.t.run(ctx => ctx.db.patch(f.employeeId, { projectId: undefined }));
    const before = await targetState(f);
    const result = await f.caller.mutation(api.pdksRecords.bulkUpsertManual, { note: "Hatalı batch denemesi", rows: [{ employeeId: kind === "foreign" ? f.otherEmployeeId : f.employeeId, date, entryTime: "25:00" }] });
    expect(result.errors).toHaveLength(1);
    expect(await targetState(f)).toEqual(before);
  });
  it("tamamen hatalı batch en fazla 20 proje özeti yazar", async () => {
    const f = await fixture("super_admin");
    const employeeIds = await f.t.run(async ctx => {
      const ids = [];
      for (let i = 0; i < 21; i++) {
        const projectId = await ctx.db.insert("projects", { name: `Proje ${i}` });
        ids.push(await ctx.db.insert("employees", { projectId, firstName: "Test", lastName: "Kişi", email: `test${i}@example.test`, cardNumber: `CARD-${i}`, isActive: true }));
      }
      return ids;
    });
    const result = await f.caller.mutation(api.pdksRecords.bulkUpsertManual, { note: "Hatalı çok proje denemesi", rows: employeeIds.map(employeeId => ({ employeeId, date, entryTime: "25:00" })) });
    expect(result.errors).toHaveLength(21);
    const audit = await f.t.run(ctx => ctx.db.query("auditLog").collect());
    expect(audit).toHaveLength(20);
    expect(audit.every(row => row.projectId && row.newValue.errors === 1)).toBe(true);
    expect(await f.t.run(ctx => ctx.db.query("pdksRecords").collect())).toEqual([]);
  });
  it("bulk audit özetine proje eklenir ve karma projeler ayrılır", async () => {
    const f = await fixture("super_admin");
    await f.caller.mutation(api.pdksRecords.bulkUpsertManual, { note: "Test düzeltme nedeni", rows: [f.employeeId, f.otherEmployeeId].map(employeeId => ({ employeeId, date, entryTime: "09:00", exitTime: "18:00" })) });
    const audit = await f.t.run(ctx => ctx.db.query("auditLog").collect());
    expect(audit.map(row => row.projectId).sort()).toEqual([f.projectId, f.otherProjectId].sort());
    expect(audit.every(row => row.targetId === "bulk-upsert" && row.newValue.touched === 1)).toBe(true);
  });
});

describe("kart atama ve olay eşleştirme", () => {
  it("project_user kart atayamaz", async () => {
    const f = await fixture("project_user");
    await expectRejectedUnchanged(f, () => f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "NEW" }] }), /yetki|projesinde değil/);
  });
  it("başka projenin admin'i kart atayamaz", async () => {
    const f = await fixture("project_admin", true);
    const before = await f.t.run(ctx => ctx.db.get(f.employeeId));
    expect(await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "NEW" }] })).toMatchObject([{ status: "error", message: "Kişiye erişim yetkiniz yok" }]);
    expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toEqual(before);
  });
  it("kendi admin'i atar fakat başka projedeki kartı tekrar kullanamaz", async () => {
    const f = await fixture();
    expect(await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "LOCAL" }] })).toMatchObject([{ status: "assigned" }]);
    const before = await f.t.run(ctx => ctx.db.get(f.employeeId));
    expect(await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "FOREIGN" }] })).toMatchObject([{ status: "error", message: "Kart numarası başka bir kişide kullanılıyor" }]);
    expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toEqual(before);
  });
  for (const brand of ["hikvision", "ide_smart", "other", "backfill"] as const) {
    it(`${brand} yalnız cihazın projesindeki kart adayını seçer`, async () => {
      const f = await fixture();
      const localId = await f.t.run(async ctx => {
        await ctx.db.patch(f.deviceId, { brand: brand === "backfill" ? "hikvision" : brand, accessDirection: "entry" });
        // Foreign duplicate deliberately predates the local candidate.
        return await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Yerel", lastName: "Kişi", email: "local@example.test", cardNumber: "FOREIGN", isActive: true });
      });
      if (brand === "backfill") {
        await f.t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId: f.deviceId, event: { time: "2026-10-20T09:00:00+03:00", cardNo: "FOREIGN", major: 5, minor: 1, serialNo: 123 } });
      } else {
        await f.t.mutation(internal.cardReadings.processCardReading, { authedDeviceId: f.deviceId, deviceSerial: "", cardNo: "FOREIGN", hikMajorEventType: 5, hikSubEventType: 1, ideIoId: 0, ideResult: 1 });
      }
      const rows = await f.t.run(ctx => ctx.db.query("cardReadings").collect());
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ projectId: f.projectId, employeeId: localId, employeeName: "Yerel Kişi" });
    });
    it(`${brand} başka projenin kişisini olaya yazmaz`, async () => {
      const f = await fixture();
      await f.t.run(ctx => ctx.db.patch(f.deviceId, { brand: brand === "backfill" ? "hikvision" : brand }));
      if (brand === "backfill") {
        await f.t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId: f.deviceId, event: { time: "2026-10-20T09:00:00+03:00", cardNo: "FOREIGN", major: 5, minor: 1, serialNo: 123 } });
      } else {
        await f.t.mutation(internal.cardReadings.processCardReading, { authedDeviceId: f.deviceId, deviceSerial: "", cardNo: "FOREIGN", ideIoId: 0, ideResult: 1 });
      }
      const rows = await f.t.run(ctx => ctx.db.query("cardReadings").collect());
      expect(rows[0]).toMatchObject({ projectId: f.projectId });
      expect(rows[0]?.employeeId).toBeUndefined();
      expect(rows[0]?.employeeName).toBeUndefined();
    });
    it(`${brand} projesiz cihaz legacy ilk eşleşmesini korur`, async () => {
      const f = await fixture();
      await f.t.run(ctx => ctx.db.patch(f.deviceId, { brand: brand === "backfill" ? "hikvision" : brand, projectId: undefined, accessDirection: "entry" }));
      if (brand === "backfill") {
        await f.t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId: f.deviceId, event: { time: "2026-10-20T09:00:00+03:00", cardNo: "FOREIGN", major: 5, minor: 1, serialNo: 123 } });
      } else {
        await f.t.mutation(internal.cardReadings.processCardReading, { authedDeviceId: f.deviceId, deviceSerial: "", cardNo: "FOREIGN", ideIoId: 0, ideResult: 1 });
      }
      expect((await f.t.run(ctx => ctx.db.query("cardReadings").collect()))[0]?.employeeId).toBe(f.otherEmployeeId);
    });
  }
});
