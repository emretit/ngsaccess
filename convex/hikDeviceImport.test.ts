// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");
it("ANKA fingerprint event uses employeeNo and Turkey wall clock, deduplicates, and preserves anonymous door events", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "ANKA" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "ANKA", brand: "hikvision", hikTransport: "gateway", hikDevIndex: "ANKA001", createdAt: "now", updatedAt: "now" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Mustafa", lastName: "Bingeloglu", cardNumber: "4", email: "", isActive: true, hikCardless: true });
    return { projectId, deviceId, employeeId };
  });
  const event = { time: "2026-09-14T15:37:19+08:00", major: 5, minor: 38, cardNo: "", employeeNoString: "4", serialNo: 30 };
  expect(await t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId: ids.deviceId, event })).toEqual({ inserted: true });
  expect(await t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId: ids.deviceId, event })).toMatchObject({ inserted: false, reason: "duplicate" });
  expect(await t.run(ctx => ctx.db.query("cardReadings").first())).toMatchObject({ employeeId: ids.employeeId, projectId: ids.projectId, cardNo: "4", accessStatus: "izin_verildi", accessTime: "2026-09-14T12:37:19.000Z" });
  expect(await t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId: ids.deviceId, event: { ...event, minor: 21, employeeNoString: "", serialNo: 584 } })).toMatchObject({ inserted: true, reason: "device-event" });
  expect(await t.run(ctx => ctx.db.query("deviceEvents").first())).toMatchObject({ eventTime: "2026-09-14T12:37:19.000Z", hikSerialNo: 584 });
  expect(await t.run(ctx => ctx.db.query("cardReadings").collect())).toHaveLength(1);
});
it("atomic import recheck catches a conflict that appeared after preview", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 100000 });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "ANKA", brand: "hikvision", hikTransport: "gateway", hikDevIndex: "ANKA001", createdAt: "now", updatedAt: "now" });
    return { projectId, deviceId, userId, sessionId };
  });
  const person = { employeeNo: "1", name: "Okan ISMAN", cards: [], fingerCount: 0 };
  expect((await t.query(internal.hikDeviceImport.classifyPersons, { projectId: ids.projectId, persons: [person] }))[0].status).toBe("new");
  await t.run(ctx => ctx.db.insert("employees", { projectId: ids.projectId, firstName: "Existing", lastName: "", cardNumber: "1", email: "" }));
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  expect(await caller.mutation(internal.hikDeviceImport.createPerson, { deviceId: ids.deviceId, userId: ids.userId, person, consent: false })).toMatchObject({ row: { status: "matched" } });
  expect(await t.run(ctx => ctx.db.query("employees").collect())).toHaveLength(1);
});
