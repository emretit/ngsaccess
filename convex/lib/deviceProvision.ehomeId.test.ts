// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { assertEhomeIdAvailable } from "./deviceProvision";

const modules = import.meta.glob("../**/*.ts");
const timestamps = { createdAt: "2026-10-22T09:00:00.000Z", updatedAt: "2026-10-22T09:00:00.000Z" };
const conflict = {
  data: {
    code: "HIK_EHOME_ID_IN_USE",
    message: "Bu Device ID (ehomeID) başka bir cihaz kaydında kullanılıyor. Önce eski kaydı silin, sonra tekrar ekleyin.",
  },
};

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const projectId = await ctx.db.insert("projects", { name: "Allowed" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Private tenant" });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    await ctx.db.insert("userProjects", { userId, projectId, role: "admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    return { projectId, otherProjectId, userId, sessionId };
  });
  return { t, ...ids, as: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function snapshot(f: Fixture) {
  return f.t.run(async (ctx) => ({
    devices: await ctx.db.query("devices").collect(),
    adminDevices: await ctx.db.query("adminDevices").collect(),
    zones: await ctx.db.query("zones").collect(),
    doors: await ctx.db.query("doors").collect(),
    readers: await ctx.db.query("readers").collect(),
  }));
}

async function create(f: Fixture, path: "generic" | "hik", ehomeID?: string) {
  const args = { projectId: f.projectId, name: "New Hik", newZoneName: "New zone", ehomeID };
  return path === "generic"
    ? f.as.mutation(api.devices.create, { ...args, brand: "hikvision" })
    : f.as.mutation(api.devices.createHikDevice, { ...args, doorCount: 1, readersPerDoor: 1 });
}

describe.each(["generic", "hik"] as const)("%s creation ehomeID uniqueness", (path) => {
  it.each(["same", "other", "pool"] as const)("rejects an inactive duplicate in %s project without writes", async (scope) => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.insert("devices", {
      name: "Private device",
      projectId: scope === "same" ? f.projectId : scope === "other" ? f.otherProjectId : undefined,
      brand: "hikvision", ehomeID: "NGS0001", status: "inactive", isActive: false, ...timestamps,
    }));
    const before = await snapshot(f);
    await expect(create(f, path, " NGS0001 ")).rejects.toMatchObject(conflict);
    expect(await snapshot(f)).toEqual(before);
  });

  it.each([undefined, "", "   "])("allows repeated empty identity %j", async (ehomeID) => {
    const f = await fixture();
    await create(f, path, ehomeID);
    await create(f, path, ehomeID);
    const state = await snapshot(f);
    expect(state.devices).toHaveLength(2);
    expect(state.devices.map((device) => device.ehomeID)).toEqual([ehomeID?.trim(), ehomeID?.trim()]);
  });

  it("stores trimmed identity and rejects its unpadded duplicate", async () => {
    const f = await fixture();
    await create(f, path, " NGS0001 ");
    const before = await snapshot(f);
    expect(before.devices[0]?.ehomeID).toBe("NGS0001");
    await expect(create(f, path, "NGS0001")).rejects.toMatchObject(conflict);
    expect(await snapshot(f)).toEqual(before);
  });
});

describe("assertEhomeIdAvailable", () => {
  it("exempts only the supplied device, even when legacy duplicates exist", async () => {
    const f = await fixture();
    const deviceId = await f.t.run((ctx) => ctx.db.insert("devices", { name: "Self", ehomeID: "NGS0001", ...timestamps }));
    await f.t.run((ctx) => assertEhomeIdAvailable(ctx, " NGS0001 ", deviceId));
    await expect(f.t.run((ctx) => assertEhomeIdAvailable(ctx, "NGS0001"))).rejects.toMatchObject(conflict);
    await f.t.run((ctx) => ctx.db.insert("devices", { name: "Legacy duplicate", ehomeID: "NGS0001", ...timestamps }));
    await expect(f.t.run((ctx) => assertEhomeIdAvailable(ctx, "NGS0001", deviceId))).rejects.toMatchObject(conflict);
  });

  it("preserves IDE and other creation without an ehomeID", async () => {
    const f = await fixture();
    await create(f, "hik", "NGS0001");
    await f.as.mutation(api.devices.createIdePanel, { name: "IDE", projectId: f.projectId, ideUuid: "ide-unique" });
    await f.as.mutation(api.devices.create, { name: "Other", projectId: f.projectId, brand: "other" });
    const state = await snapshot(f);
    expect(state.devices.map((device) => device.brand)).toEqual(["hikvision", "ide_smart", "other"]);
  });
});

describe("devices.update ehomeID uniqueness", () => {
  async function seed(f: Fixture, ehomeID: string) {
    return f.t.run((ctx) => ctx.db.insert("devices", {
      name: ehomeID, projectId: f.projectId, brand: "hikvision", ehomeID, status: "active", isActive: true, ...timestamps,
    }));
  }

  it("rejects changing to an identity used by another device, without writes", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.insert("devices", { name: "Private", projectId: f.otherProjectId, brand: "hikvision", ehomeID: "NGS0002", ...timestamps }));
    const deviceId = await seed(f, "NGS0001");
    const before = await snapshot(f);
    await expect(f.as.mutation(api.devices.update, { deviceId, ehomeID: " NGS0002 " })).rejects.toMatchObject(conflict);
    expect(await snapshot(f)).toEqual(before);
  });

  it("does not lock other edits on a legacy duplicate and stores the trimmed value", async () => {
    const f = await fixture();
    await seed(f, "NGS0001");
    const deviceId = await seed(f, "NGS0001");
    await f.as.mutation(api.devices.update, { deviceId, name: "Renamed", ehomeID: " NGS0001 " });
    const device = await f.t.run((ctx) => ctx.db.get(deviceId));
    expect(device?.name).toBe("Renamed");
    expect(device?.ehomeID).toBe("NGS0001");
  });
});
