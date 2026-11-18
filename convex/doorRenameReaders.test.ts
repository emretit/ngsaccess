// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const originalTimestamp = "2020-01-01T00:00:00.000Z";

async function setup(readerNames = ["Kapı 1"], readerName = "Kapı 1") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const projectId = await ctx.db.insert("projects", { name: "Test projesi" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 86400000,
    });
    const doorId = await ctx.db.insert("doors", {
      projectId,
      name: "Kapı 1",
      readerName,
    });
    const readerIds = await Promise.all(readerNames.map((name, index) => ctx.db.insert("readers", {
      projectId,
      doorId,
      name,
      direction: index === 0 ? "entry" : "exit",
      createdAt: originalTimestamp,
      updatedAt: originalTimestamp,
    })));
    const otherDoorId = await ctx.db.insert("doors", { projectId, name: "Kapı 1" });
    const otherReaderId = await ctx.db.insert("readers", {
      projectId,
      doorId: otherDoorId,
      name: "Kapı 1",
      direction: "entry",
      createdAt: originalTimestamp,
      updatedAt: originalTimestamp,
    });
    return { doorId, readerIds, otherReaderId, userId, sessionId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const readers = () => t.run((ctx) => Promise.all(ids.readerIds.map((id) => ctx.db.get(id))));
  return { t, caller, readers, ...ids };
}

describe("kapı yeniden adlandırıldığında okuyucu adları", () => {
  it("tek okuyucuyu ve legacy adı günceller, başka kapının okuyucusunu korur", async () => {
    const f = await setup();
    const otherBefore = await f.t.run((ctx) => ctx.db.get(f.otherReaderId));
    await f.caller.mutation(api.doors.update, { doorId: f.doorId, name: "  Giriş  " });
    const door = await f.t.run((ctx) => ctx.db.get(f.doorId));
    const [reader] = await f.readers();
    expect(door).toMatchObject({ name: "Giriş", readerName: "Giriş" });
    expect(reader).toMatchObject({ name: "Giriş", updatedAt: door?.updatedAt });
    expect(reader?.updatedAt).not.toBe(originalTimestamp);
    expect(await f.t.run((ctx) => ctx.db.get(f.otherReaderId))).toEqual(otherBefore);
    expect(await f.t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
    expect(await f.t.run((ctx) => ctx.db.query("hikPendingOperations").collect())).toEqual([]);
  });

  it("iki okuyucunun Giriş ve Çıkış soneklerini korur", async () => {
    const f = await setup(["Kapı 1 Giriş", "Kapı 1 Çıkış"]);
    await f.caller.mutation(api.doors.update, { doorId: f.doorId, name: "Ana kapı" });
    const readers = await f.readers();
    expect(readers.map((reader) => reader?.name)).toEqual(["Ana kapı Giriş", "Ana kapı Çıkış"]);
    for (const reader of readers) expect(reader?.updatedAt).not.toBe(originalTimestamp);
  });

  it("elle adlandırılmış okuyuculara ve özel legacy adına dokunmaz", async () => {
    const f = await setup(["Personel okuyucu", "Kapı 1 Giriş özel", "Kapı 10"], "Özel ad");
    const before = await f.readers();
    await f.caller.mutation(api.doors.update, { doorId: f.doorId, name: "Giriş" });
    expect(await f.readers()).toEqual(before);
    expect((await f.t.run((ctx) => ctx.db.get(f.doorId)))?.readerName).toBe("Özel ad");
  });

  it.each(["Kapı 1", "  Kapı 1  ", undefined])("ad değişmeyince okuyucuya yazmaz: %s", async (name) => {
    const f = await setup(["Kapı 1", "Kapı 1 Giriş", "Kapı 1 Çıkış"]);
    const before = await f.readers();
    await f.caller.mutation(api.doors.update, { doorId: f.doorId, ...(name !== undefined ? { name } : { location: "Kat 1" }) });
    expect(await f.readers()).toEqual(before);
    expect((await f.t.run((ctx) => ctx.db.get(f.doorId)))?.readerName).toBe("Kapı 1");
  });

  it.each(["Elle verilen", ""])("çağrıda açıkça verilen legacy adını korur: %s", async (readerName) => {
    const f = await setup();
    await f.caller.mutation(api.doors.update, { doorId: f.doorId, name: "Giriş", readerName });
    expect((await f.t.run((ctx) => ctx.db.get(f.doorId)))?.readerName).toBe(readerName);
    expect((await f.readers())[0]?.name).toBe("Giriş");
  });

  it("kapı numarası da değişince mevcut okuyucu numarası güncellemesini sürdürür", async () => {
    const f = await setup(["Kapı 1 Giriş", "Özel çıkış"]);
    await f.caller.mutation(api.doors.update, { doorId: f.doorId, name: "Giriş", hikDoorNo: 3 });
    expect(await f.readers()).toMatchObject([
      { name: "Giriş Giriş", hikReaderNo: 5 },
      { name: "Özel çıkış", hikReaderNo: 6 },
    ]);
  });

  it("mevcut izolasyon kontrolü başarısızsa kapıya ve okuyucuya yazmaz", async () => {
    const f = await setup();
    const zoneId = await f.t.run(async (ctx) => {
      const projectId = await ctx.db.insert("projects", { name: "Diğer proje" });
      return ctx.db.insert("zones", { projectId, name: "Diğer bölge" });
    });
    const before = await f.readers();
    await expect(f.caller.mutation(api.doors.update, { doorId: f.doorId, name: "Giriş", zoneId }))
      .rejects.toThrow("Seçilen bölge bu kapının projesinde değil");
    expect(await f.readers()).toEqual(before);
    expect((await f.t.run((ctx) => ctx.db.get(f.doorId)))?.name).toBe("Kapı 1");
  });
});


describe("kapı ve okuyucu mantıksal etkinliği", () => {
  it.each(["active", "inactive", undefined] as const)("create kabul eder, eksik durum active olur: %s", async (status) => {
    const f = await setup();
    const door = await f.t.run(ctx => ctx.db.get(f.doorId));
    const doorId = await f.caller.mutation(api.doors.create, { name: "Yeni kapı", projectId: door?.projectId, status });
    const readerId = await f.caller.mutation(api.readers.create, { doorId, name: "Yeni okuyucu", direction: "exit", status });
    expect((await f.t.run(ctx => ctx.db.get(doorId)))?.status).toBe(status ?? "active");
    expect((await f.t.run(ctx => ctx.db.get(readerId)))?.status).toBe(status ?? "active");
  });

  it("update active/inactive kabul eder ve durum gönderilmezse eski alanı korur", async () => {
    const f = await setup();
    const readerId = f.readerIds[0];
    if (!readerId) throw new Error("okuyucu fixture eksik");
    await f.caller.mutation(api.doors.update, { doorId: f.doorId, location: "Kat 1" });
    await f.caller.mutation(api.readers.update, { readerId, name: "Okuyucu" });
    expect((await f.t.run(ctx => ctx.db.get(f.doorId)))?.status).toBeUndefined();
    expect((await f.t.run(ctx => ctx.db.get(readerId)))?.status).toBeUndefined();
    for (const status of ["inactive", "active"] as const) {
      await f.caller.mutation(api.doors.update, { doorId: f.doorId, status });
      await f.caller.mutation(api.readers.update, { readerId, status });
      await f.caller.mutation(api.doors.update, { doorId: f.doorId, location: "Kat 2" });
      await f.caller.mutation(api.readers.update, { readerId, name: "Okuyucu 2" });
      expect((await f.t.run(ctx => ctx.db.get(f.doorId)))?.status).toBe(status);
      expect((await f.t.run(ctx => ctx.db.get(readerId)))?.status).toBe(status);
    }
  });

  it.each(["online", "", "actve"])("geçersiz API durumu hiçbir kayda yazılmaz: %s", async (status) => {
    const f = await setup();
    const before = await f.t.run(async ctx => ({ doors: await ctx.db.query("doors").collect(), readers: await ctx.db.query("readers").collect() }));
    // Model dışındaki istemcileri taklit etmek için yalnız bu çağrılarda serbest payload kullanılır.
    const calls = [
      { name: "doors:create", args: { name: "Geçersiz kapı", projectId: before.doors[0]?.projectId, status } },
      { name: "doors:update", args: { doorId: f.doorId, status } },
      { name: "readers:create", args: { doorId: f.doorId, name: "Geçersiz okuyucu", direction: "entry", status } },
      { name: "readers:update", args: { readerId: f.readerIds[0], status } },
    ];
    for (const call of calls) {
      const ref = makeFunctionReference<"mutation", Record<string, unknown>>(call.name);
      await expect(f.caller.mutation(ref, call.args)).rejects.toThrow(/Validator error: Expected one of literal, literal/);
    }
    expect(await f.t.run(async ctx => ({ doors: await ctx.db.query("doors").collect(), readers: await ctx.db.query("readers").collect() }))).toEqual(before);
  });
});
