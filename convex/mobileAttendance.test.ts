// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import type { ApiFromModules, FunctionArgs, FunctionReturnType } from "convex/server";
import { describe, expect, it } from "vitest";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";

type AttendanceApi = ApiFromModules<{ mobileAttendance: typeof import("./mobileAttendance") }>["mobileAttendance"];
const listPage = makeFunctionReference<"query", FunctionArgs<AttendanceApi["listPage"]>, FunctionReturnType<AttendanceApi["listPage"]>>("mobileAttendance:listPage");
const summary = makeFunctionReference<"query", FunctionArgs<AttendanceApi["summary"]>, FunctionReturnType<AttendanceApi["summary"]>>("mobileAttendance:summary");
const modules = import.meta.glob("./**/*.ts");
type ReadingInput = Omit<Doc<"cardReadings">, "_id" | "_creationTime">;

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectA = await ctx.db.insert("projects", { name: "Tenant A" });
    const projectB = await ctx.db.insert("projects", { name: "Tenant B" });
    const employeeA = await ctx.db.insert("employees", {
      projectId: projectA, firstName: "Fixture", lastName: "A", email: "a@example.test", cardNumber: "001", isActive: true,
    });
    const employeeB = await ctx.db.insert("employees", {
      projectId: projectB, firstName: "Fixture", lastName: "B", email: "b@example.test", cardNumber: "002", isActive: true,
    });
    for (const [employeeId, token] of [[employeeA, "fixture-session-a"], [employeeB, "fixture-session-b"]] as const) {
      await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "fixture-not-a-password", passwordVersion: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
      await ctx.db.insert("employeeSessions", { employeeId, token, passwordVersion: 1, expiresAt: "2099-01-01T00:00:00.000Z", createdAt: "2026-01-01" });
    }
    const deviceA = await ctx.db.insert("devices", { projectId: projectA, name: "Same door", deviceSerial: "fixture-a", createdAt: "2026-01-01", updatedAt: "2026-01-01" });
    const deviceB = await ctx.db.insert("devices", { projectId: projectB, name: "Same door", deviceSerial: "fixture-b", createdAt: "2026-01-01", updatedAt: "2026-01-01" });
    const deletedDevice = await ctx.db.insert("devices", { projectId: projectA, name: "Deleted", createdAt: "2026-01-01", updatedAt: "2026-01-01" });
    await ctx.db.delete(deletedDevice);
    return { projectA, projectB, employeeA, employeeB, deviceA, deviceB, deletedDevice };
  });
  const add = async (changes: Partial<ReadingInput> = {}) => t.run(ctx => ctx.db.insert("cardReadings", {
    projectId: ids.projectA, employeeId: ids.employeeA, deviceId: ids.deviceA, cardNo: "001",
    accessTime: "2026-10-19T06:00:00.000Z", accessStatus: "izin_verildi", direction: "entry", ...changes,
  }));
  return { t, ...ids, add, sessionToken: "fixture-session-a", sessionB: "fixture-session-b" };
}

describe("mobileAttendance actual employee session boundary", () => {
  it("isolates A/B sessions and redacts foreign/deleted device enrichment without losing own history", async () => {
    const f = await fixture();
    const own = await f.add();
    const foreignDevice = await f.add({ deviceId: f.deviceB });
    const orphan = await f.add({ deviceId: f.deletedDevice });
    const missing = await f.add({ deviceId: undefined });
    const foreignEmployee = await f.add({ projectId: f.projectB, employeeId: f.employeeB, deviceId: f.deviceB });
    const a = await f.t.query(listPage, { sessionToken: f.sessionToken });
    expect(a.page.map(row => row._id).sort()).toEqual([own, foreignDevice, orphan, missing].sort());
    expect(a.page.find(row => row._id === own)?.device).toMatchObject({ _id: f.deviceA, deviceSerial: "fixture-a" });
    for (const id of [foreignDevice, orphan, missing]) expect(a.page.find(row => row._id === id)?.device).toBeNull();
    const b = await f.t.query(listPage, { sessionToken: f.sessionB });
    expect(b.page.map(row => row._id)).toEqual([foreignEmployee]);
    const spoofedIdentity = { sessionToken: f.sessionToken, employeeId: f.employeeB };
    await expect(f.t.query(listPage, spoofedIdentity)).rejects.toThrow();
    for (const deviceId of [f.deviceB, f.deletedDevice]) {
      await expect(f.t.query(listPage, { sessionToken: f.sessionToken, deviceId })).rejects.toMatchObject({ data: { code: "DEVICE_NOT_FOUND" } });
    }
    await expect(f.t.query(listPage, { sessionToken: "unknown-fixture" })).rejects.toMatchObject({ data: { code: "SESSION_INVALID" } });
    await f.t.run(async ctx => { await ctx.db.patch(f.employeeA, { isActive: false }); });
    await expect(f.t.query(summary, { sessionToken: f.sessionToken, startDate: "2026-10-19", endDate: "2026-10-19" }))
      .rejects.toMatchObject({ data: { code: "EMPLOYEE_INACTIVE" } });
  });

  it("orders by event time, keeps equal-time records exactly once, and freezes archive membership against backfill", async () => {
    const f = await fixture();
    const latest = await f.add({ accessTime: "2026-10-19T08:00:00.000Z" });
    const equalA = await f.add({ accessTime: "2026-10-19T07:00:00.000Z" });
    const equalB = await f.add({ accessTime: "2026-10-19T07:00:00.000Z" });
    const oldest = await f.add({ accessTime: "2026-10-01T07:00:00.000Z" });
    const first = await f.t.query(listPage, { sessionToken: f.sessionToken, numItems: 1 });
    expect(first.page.map(row => row._id)).toEqual([latest]);
    const second = await f.t.query(listPage, { sessionToken: f.sessionToken, cursor: first.continueCursor, numItems: 1 });
    const insertedBackfill = await f.add({ accessTime: "2026-10-19T07:30:00.000Z" });
    expect(await f.t.query(listPage, { sessionToken: f.sessionToken, cursor: first.continueCursor, numItems: 1 })).toEqual(second);
    const seen = [...first.page, ...second.page];
    let cursor = second.continueCursor;
    let done = second.isDone;
    for (let count = 0; count < 8 && !done; count++) {
      const next = await f.t.query(listPage, { sessionToken: f.sessionToken, cursor, numItems: 1 });
      seen.push(...next.page); cursor = next.continueCursor; done = next.isDone;
    }
    expect(done).toBe(true);
    expect(seen.map(row => row._id).sort()).toEqual([latest, equalA, equalB, oldest].sort());
    expect(new Set(seen.map(row => row._id)).size).toBe(4);
    expect(seen.map(row => row._id)).not.toContain(insertedBackfill);
    expect((await f.t.query(listPage, { sessionToken: f.sessionToken })).page.map(row => row._id)).toContain(insertedBackfill);
    expect(await f.t.query(listPage, { sessionToken: f.sessionToken, cursor })).toMatchObject({ page: [], isDone: true });
  });

  it("rejects cursors reused under another identity, tenant or filter set, and validates page/date input", async () => {
    const f = await fixture();
    await f.add(); await f.add();
    const first = await f.t.query(listPage, { sessionToken: f.sessionToken, numItems: 1 });
    for (const changes of [{ sessionToken: f.sessionB }, { startDate: "2026-10-19" }, { endDate: "2026-10-20" }, { deviceId: f.deviceA }]) {
      await expect(f.t.query(listPage, { sessionToken: f.sessionToken, cursor: first.continueCursor, ...changes }))
        .rejects.toMatchObject({ data: { code: "INVALID_CURSOR" } });
    }
    for (const cursor of ["", "not-json", "{}", "[]", JSON.stringify({ version: 1, context: "wrong", position: "[]", snapshotCreationTime: 1 })]) {
      await expect(f.t.query(listPage, { sessionToken: f.sessionToken, cursor })).rejects.toMatchObject({ data: { code: "INVALID_CURSOR" } });
    }
    const validCursor: unknown = JSON.parse(first.continueCursor);
    if (validCursor === null || typeof validCursor !== "object") throw new Error("Expected cursor envelope");
    for (const position of ["{}", "null", "[1]", JSON.stringify([f.employeeB, "2026-10-19T06:00:00.000Z", 1, "forged-id"])]) {
      await expect(f.t.query(listPage, { sessionToken: f.sessionToken, cursor: JSON.stringify({ ...validCursor, position }) }))
        .rejects.toMatchObject({ data: { code: "INVALID_CURSOR" } });
    }
    for (const numItems of [0, 101, -1, 1.5]) {
      await expect(f.t.query(listPage, { sessionToken: f.sessionToken, numItems })).rejects.toMatchObject({ data: { code: "INVALID_ARGUMENT" } });
    }
    for (const dates of [{ startDate: "2026-02-30" }, { endDate: "2026-1-01" }, { startDate: "2026-10-20", endDate: "2026-10-19" }]) {
      await expect(f.t.query(listPage, { sessionToken: f.sessionToken, ...dates })).rejects.toMatchObject({ data: { code: "INVALID_ARGUMENT" } });
    }
    await f.t.run(async ctx => { await ctx.db.patch(f.employeeA, { projectId: f.projectB }); });
    await expect(f.t.query(listPage, { sessionToken: f.sessionToken, cursor: first.continueCursor })).rejects.toMatchObject({ data: { code: "INVALID_CURSOR" } });
  });

  it("filters older matching devices on the server and includes exactly Istanbul midnight through day-end", async () => {
    const f = await fixture();
    const secondDevice = await f.t.run(ctx => ctx.db.insert("devices", { projectId: f.projectA, name: "Same door", createdAt: "2026-01-01", updatedAt: "2026-01-01" }));
    const before = await f.add({ deviceId: secondDevice, accessTime: "2026-10-18T20:59:59.999Z" });
    const midnight = await f.add({ deviceId: secondDevice, accessTime: "2026-10-18T21:00:00.000Z" });
    const end = await f.add({ deviceId: secondDevice, accessTime: "2026-10-19T20:59:59.999Z" });
    const after = await f.add({ deviceId: secondDevice, accessTime: "2026-10-19T21:00:00.000Z" });
    await f.t.run(async ctx => {
      for (let i = 0; i < 70; i++) await ctx.db.insert("cardReadings", {
        projectId: f.projectA, employeeId: f.employeeA, deviceId: f.deviceA, cardNo: "001", accessTime: `2026-10-20T07:00:${String(i % 60).padStart(2, "0")}.000Z`,
      });
    });
    const result = await f.t.query(listPage, { sessionToken: f.sessionToken, deviceId: secondDevice, startDate: "2026-10-19", endDate: "2026-10-19" });
    expect(result.page.map(row => row._id)).toEqual([end, midnight]);
    expect(result.page.map(row => row._id)).not.toContain(before);
    expect(result.page.map(row => row._id)).not.toContain(after);
  });

  it("continues through an empty bounded page when a large newer backfill is outside the archive snapshot", async () => {
    const f = await fixture();
    const firstId = await f.add({ accessTime: "2026-10-19T10:00:00.000Z" });
    const lastId = await f.add({ accessTime: "2026-10-19T06:00:00.000Z" });
    const first = await f.t.query(listPage, { sessionToken: f.sessionToken, numItems: 1 });
    expect(first.page[0]?._id).toBe(firstId);
    await f.t.run(async ctx => {
      for (let i = 0; i < 1001; i++) await ctx.db.insert("cardReadings", {
        projectId: f.projectA, employeeId: f.employeeA, cardNo: "001", accessTime: "2026-10-19T08:00:00.000Z",
      });
    });
    const skipped = await f.t.query(listPage, { sessionToken: f.sessionToken, cursor: first.continueCursor });
    expect(skipped).toMatchObject({ page: [], isDone: false });
    expect(skipped.continueCursor).not.toBe(first.continueCursor);
    const next = await f.t.query(listPage, { sessionToken: f.sessionToken, cursor: skipped.continueCursor });
    expect(next.page.map(row => row._id)).toEqual([lastId]);
    expect(next.isDone).toBe(true);
  });

  it("enforces byte bounds with resumable short list pages and an explicit unavailable summary", async () => {
    const f = await fixture();
    for (let i = 0; i < 15; i++) await f.add({ rawData: "x".repeat(600_000) });
    let page = await f.t.query(listPage, { sessionToken: f.sessionToken, numItems: 100 });
    expect(page.page.length).toBeGreaterThan(0);
    expect(page.page.length).toBeLessThan(15);
    const seen = page.page.map(row => row._id);
    for (let count = 0; count < 20 && !page.isDone; count++) {
      page = await f.t.query(listPage, { sessionToken: f.sessionToken, cursor: page.continueCursor, numItems: 100 });
      seen.push(...page.page.map(row => row._id));
    }
    expect(page.isDone).toBe(true);
    expect(seen).toHaveLength(15);
    expect(new Set(seen).size).toBe(15);
    await expect(f.t.query(summary, { sessionToken: f.sessionToken, startDate: "2026-10-19", endDate: "2026-10-19" }))
      .rejects.toMatchObject({ data: { code: "SUMMARY_TOO_LARGE" } });
  });
});

describe("mobileAttendance independent raw movement summary", () => {
  it("returns the same complete 150-row period before and after loading all archive pages", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 150; i++) await ctx.db.insert("cardReadings", {
        projectId: f.projectA, employeeId: f.employeeA, deviceId: f.deviceA, cardNo: "001", accessTime: `2026-10-${String(1 + Math.floor(i / 10)).padStart(2, "0")}T06:${String(i % 10).padStart(2, "0")}:00.000Z`,
        direction: i % 2 === 0 ? "entry" : "exit", accessStatus: "izin_verildi",
      });
    });
    const args = { sessionToken: f.sessionToken, startDate: "2026-10-01", endDate: "2026-10-31" };
    const summaryStarted = performance.now();
    const before = await f.t.query(summary, args);
    const summaryMs = performance.now() - summaryStarted;
    let page = await f.t.query(listPage, { sessionToken: f.sessionToken });
    expect(page.page).toHaveLength(50);
    const liveHead = page.page;
    let total = page.page.length;
    while (!page.isDone) { page = await f.t.query(listPage, { sessionToken: f.sessionToken, cursor: page.continueCursor }); total += page.page.length; }
    expect(total).toBe(150);
    const after = await f.t.query(summary, args);
    expect(before.days).toEqual(after.days);
    expect(before.totals).toEqual({ entryCount: 75, exitCount: 75, deniedCount: 0, unknownCount: 0, presentDays: 15 });
    expect(after.totals).toEqual(before.totals);
    expect(after.days).toHaveLength(31);
    expect(after.days[30]).toMatchObject({ date: "2026-10-31", entryCount: 0, lastDirection: "unknown" });
    expect(after.timeZone).toBe("Europe/Istanbul");
    expect(Number.isFinite(Date.parse(after.generatedAt))).toBe(true);
    const refreshedHead = await f.t.query(listPage, { sessionToken: f.sessionToken });
    expect(refreshedHead.page).toEqual(liveHead);
    // Numeric-only fixture measurements; never log tokens or row bodies.
    console.info("mobileAttendance synthetic fixture", {
      periodRows: 150, liveRowsBeforeAndAfterArchive: liveHead.length,
      livePageBytes: new TextEncoder().encode(JSON.stringify(liveHead)).byteLength,
      summaryDays: after.days.length, summaryBytes: new TextEncoder().encode(JSON.stringify(after)).byteLength,
      summaryMs: Math.round(summaryMs * 100) / 100,
    });
  });

  it("keeps denied, missing status/direction and ineligible source events out of participation", async () => {
    const f = await fixture();
    const entry = "2026-10-19T06:00:00.000Z";
    const exit = "2026-10-19T15:00:00.000Z";
    await f.add({ accessTime: entry });
    await f.add({ accessTime: exit, direction: "exit" });
    await f.add({ accessTime: "2026-10-19T16:00:00.000Z", accessStatus: "reddedildi" });
    await f.add({ direction: undefined });
    await f.add({ accessStatus: undefined });
    await f.add({ hikCurrentVerifyMode: "face" });
    await f.add({ hikMajorEventType: 5, hikSubEventType: 999 });
    await f.add({ projectId: f.projectB });
    await f.add({ employeeId: f.employeeB, projectId: f.projectB });
    const result = await f.t.query(summary, { sessionToken: f.sessionToken, startDate: "2026-10-19", endDate: "2026-10-19" });
    expect(result.days).toEqual([{
      date: "2026-10-19", entryCount: 1, exitCount: 1, deniedCount: 1, unknownCount: 5,
      firstEntry: entry, lastEntry: entry, lastExit: exit, lastDirection: "exit",
    }]);
    expect(result.totals.presentDays).toBe(1);
  });

  it("treats overnight exit as a new calendar day and never invents a late/shift/payroll result", async () => {
    const f = await fixture();
    await f.add({ accessTime: "2026-10-19T20:00:00.000Z" }); // Istanbul 23:00
    await f.add({ accessTime: "2026-10-19T22:00:00.000Z", direction: "exit" }); // Istanbul 01:00 next day
    await f.add({ accessTime: "2026-10-18T21:00:00.000Z", accessStatus: "reddedildi" }); // exact midnight
    const result = await f.t.query(summary, { sessionToken: f.sessionToken, startDate: "2026-10-19", endDate: "2026-10-21" });
    expect(result.days[0]).toMatchObject({ date: "2026-10-19", entryCount: 1, exitCount: 0, deniedCount: 1, lastDirection: "entry" });
    expect(result.days[1]).toMatchObject({ date: "2026-10-20", entryCount: 0, exitCount: 1, lastDirection: "exit" });
    expect(result.days[2]).toMatchObject({ date: "2026-10-21", entryCount: 0, exitCount: 0, lastDirection: "unknown" });
    expect(result.totals.presentDays).toBe(1);
    expect(result).not.toHaveProperty("lateCount");
  });

  it("makes a later uncertain movement unknown while denied attempts preserve prior state", async () => {
    const f = await fixture();
    await f.add({ accessTime: "2026-10-19T06:00:00.000Z" });
    await f.add({ accessTime: "2026-10-19T07:00:00.000Z", accessStatus: "reddedildi" });
    const args = { sessionToken: f.sessionToken, startDate: "2026-10-19", endDate: "2026-10-19" };
    expect((await f.t.query(summary, args)).days[0]?.lastDirection).toBe("entry");
    await f.add({ accessTime: "2026-10-19T08:00:00.000Z", direction: undefined });
    await f.add({ accessTime: "2026-10-19T09:00:00.000Z", accessStatus: "reddedildi" });
    expect((await f.t.query(summary, args)).days[0]).toMatchObject({ entryCount: 1, unknownCount: 1, deniedCount: 2, lastDirection: "unknown" });
    await f.add({ accessTime: "2026-10-19T10:00:00.000Z", direction: "exit" });
    expect((await f.t.query(summary, args)).days[0]?.lastDirection).toBe("exit");
  });

  it("returns typed unavailable for malformed in-range stored timestamps instead of silently undercounting", async () => {
    const f = await fixture();
    await f.add({ accessTime: "2026-10-19T06:broken" });
    await expect(f.t.query(summary, { sessionToken: f.sessionToken, startDate: "2026-10-19", endDate: "2026-10-19" }))
      .rejects.toMatchObject({ data: { code: "SUMMARY_INVALID_DATA" } });
    // Date.parse normalizes February 30 to March 2; it must not silently vanish
    // when its stored index key lies in a February 28–March 1 query.
    await f.add({ accessTime: "2026-02-30T06:00:00.000Z" });
    await expect(f.t.query(summary, { sessionToken: f.sessionToken, startDate: "2026-02-28", endDate: "2026-03-01" }))
      .rejects.toMatchObject({ data: { code: "SUMMARY_INVALID_DATA" } });
  });

  it("rejects invalid/reversed dates and oversized periods instead of returning fabricated empty totals", async () => {
    const f = await fixture();
    for (const dates of [{ startDate: "2026-02-29", endDate: "2026-03-01" }, { startDate: "2026-10-20", endDate: "2026-10-19" }]) {
      await expect(f.t.query(summary, { sessionToken: f.sessionToken, ...dates })).rejects.toMatchObject({ data: { code: "INVALID_ARGUMENT" } });
    }
    await expect(f.t.query(summary, { sessionToken: f.sessionToken, startDate: "2026-01-01", endDate: "2026-04-04" }))
      .rejects.toMatchObject({ data: { code: "SUMMARY_TOO_LARGE" } });
    expect((await f.t.query(summary, { sessionToken: f.sessionToken, startDate: "2024-02-29", endDate: "2024-03-01" })).days).toHaveLength(2);
    expect((await f.t.query(summary, { sessionToken: f.sessionToken, startDate: "2026-01-01", endDate: "2026-04-03" })).days).toHaveLength(93);
  });

  it("fails explicitly at 10001 readings and accepts exactly 10000", async () => {
    const f = await fixture();
    // Seed in bounded transactions, using the actual database/index/pagination implementation.
    for (let batch = 0; batch < 10; batch++) {
      await f.t.run(async ctx => {
        for (let i = 0; i < 1000; i++) await ctx.db.insert("cardReadings", {
          projectId: f.projectA, employeeId: f.employeeA, cardNo: "001", accessTime: "2026-10-19T06:00:00.000Z", direction: "entry", accessStatus: "izin_verildi",
        });
      });
    }
    const args = { sessionToken: f.sessionToken, startDate: "2026-10-19", endDate: "2026-10-19" };
    expect((await f.t.query(summary, args)).totals.entryCount).toBe(10000);
    await f.add();
    await expect(f.t.query(summary, args)).rejects.toMatchObject({ data: { code: "SUMMARY_TOO_LARGE" } });
  }, 30_000);
});
