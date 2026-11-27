// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { parseCardReaderBody } from "./lib/cardReaderParse";
import { buildPdksEmployeeReadingMap } from "./lib/pdksTable";
const modules = import.meta.glob("./**/*.ts");

it.each(["", "456"])("attributes live and backfilled biometrics to the imported person before physical card fallback (%j)", async cardNumber => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Imported", lastName: "Person", email: "", cardNumber, hikEmployeeNo: "7", isActive: true });
    const cardOwnerId = await ctx.db.insert("employees", { projectId, firstName: "Legacy", lastName: "Card", email: "", cardNumber: "7", isActive: true });
    await ctx.db.insert("employees", { projectId: otherProjectId, firstName: "Foreign", lastName: "Person", email: "", cardNumber: "", hikEmployeeNo: "7", isActive: true });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Hik", brand: "hikvision", hikTransport: "gateway", hikDevIndex: "index", accessDirection: "entry", isActive: true, createdAt: "", updatedAt: "" });
    return { employeeId, cardOwnerId, deviceId };
  });
  const time = new Date().toISOString();
  const parsed = parseCardReaderBody(JSON.stringify({ AccessControllerEvent: { cardNo: "", employeeNoString: "7", majorEventType: 5, subEventType: 1, currentVerifyMode: "face", dateTime: time } }), "application/json");
  expect(parsed).toMatchObject({ user_id: "7", hikEmployeeNo: "7" });
  await t.mutation(internal.cardReadings.processCardReading, { cardNo: parsed.user_id ?? "", deviceSerial: "", authedDeviceId: ids.deviceId, hikEmployeeNo: parsed.hikEmployeeNo, hikMajorEventType: parsed.hikMajorEventType, hikSubEventType: parsed.hikSubEventType, hikCurrentVerifyMode: parsed.hikCurrentVerifyMode, hikDateTime: time });
  await t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId: ids.deviceId, event: { time, cardNo: "", employeeNoString: "7", major: 5, minor: 1, currentVerifyMode: "fingerprint", serialNo: 2 } });
  const rows = await t.run(ctx => ctx.db.query("cardReadings").collect());
  expect(rows).toHaveLength(2);
  expect(rows.every(row => row.employeeId === ids.employeeId && row.accessStatus === "izin_verildi")).toBe(true);
  const people = await t.run(ctx => ctx.db.query("employees").collect());
  expect(buildPdksEmployeeReadingMap({ employees: people, readings: rows }).get(ids.employeeId)).toHaveLength(2);
  await t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId: ids.deviceId, event: { time, cardNo: "7", employeeNoString: "7", major: 5, minor: 1, serialNo: 3 } });
  expect((await t.run(ctx => ctx.db.query("cardReadings").withIndex("by_device_hik_serial", q => q.eq("deviceId", ids.deviceId).eq("hikSerialNo", 3)).first()))?.employeeId).toBe(ids.employeeId);
  await t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId: ids.deviceId, event: { time, cardNo: "7", employeeNoString: "legacy-id", major: 5, minor: 1, serialNo: 4 } });
  expect((await t.run(ctx => ctx.db.query("cardReadings").withIndex("by_device_hik_serial", q => q.eq("deviceId", ids.deviceId).eq("hikSerialNo", 4)).first()))?.employeeId).toBe(ids.cardOwnerId);
});

it("preserves the cardless person identity in XML reader events", () => {
  expect(parseCardReaderBody("<EventNotificationAlert><cardNo></cardNo><employeeNoString>7</employeeNoString></EventNotificationAlert>", "application/xml")).toMatchObject({ user_id: "7", hikEmployeeNo: "7" });
});
