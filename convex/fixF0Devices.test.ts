// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { assertIdeUuidAvailable } from "./lib/deviceProvision";

const modules = import.meta.glob("./**/*.ts");
const uuid = "123456789012345";
const otherUuid = "123456789012346";
const timestamps = { createdAt: "2026-10-25T09:00:00Z", updatedAt: "2026-10-25T09:00:00Z" };
const conflict = { data: { code: "IDE_UUID_IN_USE" } };

async function fixture(role: "super_admin" | "project_user" = "super_admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role, verified: true });
    await ctx.db.insert("userProjects", { userId, projectId, role: "admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    return { projectId, otherProjectId, userId, sessionId };
  });
  return { t, ...ids, as: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function snapshot(f: Fixture) {
  return f.t.run(async ctx => ({
    devices: await ctx.db.query("devices").collect(), adminDevices: await ctx.db.query("adminDevices").collect(),
    zones: await ctx.db.query("zones").collect(), doors: await ctx.db.query("doors").collect(),
  }));
}
async function create(f: Fixture, ideUuid = uuid) {
  return f.as.mutation(api.devices.create, { name: "Panel", projectId: f.projectId, brand: "ide_smart", ideUuid });
}

for (const source of ["devices", "adminDevices"] as const) {
  it(`create/update/register reject inactive UUID owned by ${source} in another project`, async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      if (source === "devices") {
        await ctx.db.insert("devices", { name: "Private", projectId: f.otherProjectId, ideUuid: uuid, isActive: false, ...timestamps });
      } else {
        await ctx.db.insert("adminDevices", { name: "Private pool", assignedProjectId: f.otherProjectId, ideUuid: uuid, ...timestamps });
      }
    });
    const deviceId = await create(f, otherUuid);
    const before = await snapshot(f);
    await expect(create(f, ` ${uuid} `)).rejects.toMatchObject(conflict);
    await expect(f.as.mutation(api.devices.createIdePanel, { name: "Panel", projectId: f.projectId, ideUuid: uuid })).rejects.toMatchObject(conflict);
    await expect(f.as.mutation(api.devices.update, { deviceId, ideUuid: ` ${uuid} ` })).rejects.toMatchObject(conflict);
    await expect(f.as.mutation(api.adminDevices.register, { ideUuid: uuid })).rejects.toMatchObject(conflict);
    await expect(f.t.mutation(internal.devices.setIdeUuid, { deviceId, ideUuid: uuid })).rejects.toMatchObject(conflict);
    expect(await snapshot(f)).toEqual(before);
  });
}

it("normalizes UUID and exempts only the same device's linked pool record", async () => {
  const f = await fixture();
  const deviceId = await create(f, ` ${uuid} `);
  await f.as.mutation(api.devices.update, { deviceId, ideUuid: ` ${uuid} `, name: "Renamed" });
  await f.as.mutation(api.devices.update, { deviceId, ideUuid: ` ${otherUuid} ` });
  const state = await snapshot(f);
  expect(state.devices[0]).toMatchObject({ name: "Renamed", ideUuid: otherUuid });
  expect(state.adminDevices[0]?.ideUuid).toBe(otherUuid);
  await f.t.run(ctx => assertIdeUuidAvailable(ctx, otherUuid, { exceptDeviceId: deviceId }));
  await f.t.run(ctx => ctx.db.insert("adminDevices", { name: "Duplicate", ideUuid: otherUuid, ...timestamps }));
  await expect(f.t.run(ctx => assertIdeUuidAvailable(ctx, otherUuid, { exceptDeviceId: deviceId }))).rejects.toMatchObject(conflict);
});

it.each(["bad", "1234567890123456", ""])("rejects malformed UUID %j in create/update/register/claim", async ideUuid => {
  const f = await fixture();
  const deviceId = await create(f);
  const adminDeviceId = await f.t.run(ctx => ctx.db.insert("adminDevices", { name: "Bad", ideUuid, ...timestamps }));
  const before = await snapshot(f);
  await expect(create(f, ideUuid)).rejects.toThrow(/UUID|kimliği/);
  await expect(f.as.mutation(api.devices.createIdePanel, { name: "Bad", projectId: f.projectId, ideUuid })).rejects.toThrow(/UUID|kimliği/);
  await expect(f.as.mutation(api.devices.update, { deviceId, ideUuid })).rejects.toThrow(/UUID|kimliği/);
  await expect(f.as.mutation(api.adminDevices.register, { ideUuid })).rejects.toThrow(/UUID|kimliği/);
  await expect(f.as.mutation(api.devices.claimDevice, { adminDeviceId, projectId: f.projectId })).rejects.toThrow(/UUID|kimliği/);
  expect(await snapshot(f)).toEqual(before);
});

it.each(["claimDevice", "reassignDevice"] as const)("%s rejects another project's duplicate UUID before creating topology", async method => {
  const f = await fixture();
  await create(f);
  const adminDeviceId = await f.t.run(ctx => ctx.db.insert("adminDevices", { name: "Duplicate", ideUuid: uuid, ...timestamps }));
  const before = await snapshot(f);
  await expect(f.as.mutation(api.devices[method], { adminDeviceId, projectId: f.otherProjectId })).rejects.toMatchObject(conflict);
  expect(await snapshot(f)).toEqual(before);
});

async function pool(f: Fixture) {
  const adminDeviceId = await f.as.mutation(api.adminDevices.register, { ideUuid: ` ${uuid} ` });
  const result = await f.as.mutation(api.devices.claimDevice, { adminDeviceId, projectId: f.projectId });
  return { adminDeviceId, ...result };
}
async function roster(f: Fixture, deviceId: Awaited<ReturnType<typeof pool>>["deviceId"]) {
  await f.t.run(ctx => ctx.db.insert("idePanelUsers", { ideUuid: uuid, deviceId, projectId: f.projectId, cardNumber: "123", syncedAt: Date.now() }));
}

it("first claim and empty-roster project move succeed with the same pool identity", async () => {
  const f = await fixture();
  const { adminDeviceId } = await pool(f);
  await f.as.mutation(api.devices.reassignDevice, { adminDeviceId, projectId: f.otherProjectId });
  expect((await snapshot(f)).devices).toEqual([expect.objectContaining({ projectId: f.otherProjectId, ideUuid: uuid })]);
});

it("populated IDE project move rejects; same-project name edit succeeds", async () => {
  const f = await fixture();
  const { adminDeviceId, deviceId } = await pool(f);
  await roster(f, deviceId);
  const before = await snapshot(f);
  await expect(f.as.mutation(api.devices.reassignDevice, { adminDeviceId, projectId: f.otherProjectId, name: "Blocked" }))
    .rejects.toThrow(/IDE_DEVICE_MOVE_UNSUPPORTED/);
  expect(await snapshot(f)).toEqual(before);
  await f.as.mutation(api.devices.reassignDevice, { adminDeviceId, projectId: f.projectId, name: "Renamed" });
  expect((await snapshot(f)).devices[0]?.name).toBe("Renamed");
});

it.each(["claimDevice", "reassignDevice"] as const)("release then %s cannot bypass old panel roster", async method => {
  const f = await fixture();
  const { adminDeviceId, deviceId } = await pool(f);
  await roster(f, deviceId);
  await f.as.mutation(api.devices.releaseDevice, { deviceId });
  const before = await snapshot(f);
  await expect(f.as.mutation(api.devices[method], { adminDeviceId, projectId: f.otherProjectId })).rejects.toThrow(/IDE_DEVICE_MOVE_UNSUPPORTED/);
  expect(await snapshot(f)).toEqual(before);
});

it.each(["claimDevice", "reassignDevice"] as const)("release then %s back to the roster project succeeds", async method => {
  const f = await fixture();
  const { adminDeviceId, deviceId } = await pool(f);
  await roster(f, deviceId);
  await f.as.mutation(api.devices.releaseDevice, { deviceId });
  await f.as.mutation(api.devices[method], { adminDeviceId, projectId: f.projectId });
  expect((await snapshot(f)).devices).toEqual([expect.objectContaining({ projectId: f.projectId, ideUuid: uuid })]);
});

it("unassign preserves roster ownership for the next claim", async () => {
  const f = await fixture();
  const { adminDeviceId, deviceId } = await pool(f);
  await roster(f, deviceId);
  await f.as.mutation(api.devices.reassignDevice, { adminDeviceId });
  expect((await snapshot(f)).devices).toEqual([]);
  const before = await snapshot(f);
  await expect(f.as.mutation(api.devices.claimDevice, { adminDeviceId, projectId: f.otherProjectId }))
    .rejects.toMatchObject({ data: { code: "IDE_DEVICE_MOVE_UNSUPPORTED" } });
  expect(await snapshot(f)).toEqual(before);
  await f.as.mutation(api.devices.claimDevice, { adminDeviceId, projectId: f.projectId });
  expect((await snapshot(f)).devices[0]?.projectId).toBe(f.projectId);
});

describe.each(["create", "createIdePanel"] as const)("%s roster ownership", method => {
  it.each(["remove", "releaseDevice"] as const)("%s then create in another project rejects old roster", async removal => {
    const f = await fixture();
    const deviceId = await create(f);
    await roster(f, deviceId);
    await f.as.mutation(api.devices[removal], { deviceId });
    const before = await snapshot(f);
    await expect(f.as.mutation(api.devices[method], { name: "Foreign", projectId: f.otherProjectId, ideUuid: ` ${uuid} ` }))
      .rejects.toMatchObject({ data: { code: "IDE_DEVICE_MOVE_UNSUPPORTED" } });
    expect(await snapshot(f)).toEqual(before);
    await f.as.mutation(api.devices[method], { name: "Same project", projectId: f.projectId, ideUuid: uuid });
    expect((await snapshot(f)).devices[0]?.projectId).toBe(f.projectId);
  });

  it("empty roster allows recreation in another project", async () => {
    const f = await fixture();
    const deviceId = await create(f);
    await f.as.mutation(api.devices.remove, { deviceId });
    await f.as.mutation(api.devices[method], { name: "Foreign", projectId: f.otherProjectId, ideUuid: uuid });
    expect((await snapshot(f)).devices[0]?.projectId).toBe(f.otherProjectId);
  });
});

it("legacy roster without projectId uses its device project and checks every row", async () => {
  const f = await fixture();
  const { adminDeviceId, deviceId } = await pool(f);
  await roster(f, deviceId);
  await f.t.run(async ctx => {
    const foreignDeviceId = await ctx.db.insert("devices", { name: "Legacy", projectId: f.otherProjectId, ...timestamps });
    await ctx.db.insert("idePanelUsers", { ideUuid: uuid, deviceId: foreignDeviceId, cardNumber: "456", syncedAt: Date.now() });
  });
  const before = await snapshot(f);
  await expect(f.as.mutation(api.devices.reassignDevice, { adminDeviceId, projectId: f.projectId }))
    .rejects.toMatchObject({ data: { code: "IDE_DEVICE_MOVE_UNSUPPORTED" } });
  expect(await snapshot(f)).toEqual(before);
});

it("legacy roster allows its device project when projectId is absent", async () => {
  const f = await fixture();
  const { adminDeviceId, deviceId } = await pool(f);
  await f.t.run(ctx => ctx.db.insert("idePanelUsers", { ideUuid: uuid, deviceId, cardNumber: "123", syncedAt: Date.now() }));
  await f.as.mutation(api.devices.reassignDevice, { adminDeviceId, projectId: f.projectId, name: "Renamed" });
  expect((await snapshot(f)).devices[0]?.name).toBe("Renamed");
});

it("project and role guards remain before identity writes", async () => {
  const f = await fixture("project_user");
  await create(f);
  await expect(f.as.mutation(api.devices.create, { name: "Foreign", projectId: f.otherProjectId, ideUuid: otherUuid })).rejects.toThrow(/yetkiniz/);
  await expect(f.as.mutation(api.adminDevices.register, { ideUuid: otherUuid })).rejects.toThrow();
});

describe("bridge HTTP → markAck error contract", () => {
  it.each(["upsertUser", "upsertPermission"] as const)("already_exists converts %s create to update via HTTP", async opType => {
    const f = await fixture();
    const deviceId = await create(f);
    const opId = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId, opType, payload: { mode: "create", userRecord: { id: 123 } } });
    await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 42 });
    vi.stubEnv("IDE_BRIDGE_SECRET", "test-secret");
    try {
      const routerModule = "../scripts/lib/ide-mqtt-routing.mjs";
      const router: { routeMqttMessage: (topic: string, buf: { toString: () => string }, dependencies: unknown) => Promise<void> } = await import(routerModule);
      let responseStatus: number | undefined;
      await router.routeMqttMessage(`device/publish/${uuid}`, {
        toString: () => JSON.stringify({ transaction: { "src-id": uuid, "msx-id": 42 },
          payload: { result: "fail", message: "already exists: cardNumber=123; password=secret" } }),
      }, {
        pending: new Map([[42, { opId, deviceUuid: uuid }]]), loginWaiters: new Map(), tokenCache: new Map(),
        convexPost: async (path: string, body: unknown) => {
          expect(body).toMatchObject({ opId, result: "fail", errorCode: "already_exists" });
          expect(JSON.stringify(body)).not.toContain("secret");
          const response = await f.t.fetch(path, { method: "POST", headers: { Authorization: "Bearer test-secret", "Content-Type": "application/json" }, body: JSON.stringify(body) });
          responseStatus = response.status;
          return { ok: response.ok };
        },
      });
      expect(responseStatus).toBe(200);
      expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "pending", payload: { mode: "update" } });
    } finally { vi.unstubAllEnvs(); }
  });

  it.each([
    { errorCode: undefined, message: "record already exists", expected: "update" },
    { errorCode: "not_found", message: "already exists", expected: "create" },
  ])("supports legacy text and gives explicit errorCode priority: %j", async ({ errorCode, message, expected }) => {
    const f = await fixture(); const deviceId = await create(f);
    const opId = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId, opType: "upsertUser", payload: { mode: "create" } });
    await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 42 });
    await f.t.mutation(internal.ideSync.markAck, { opId, msxId: 42, result: "fail", errorCode, message });
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ payload: { mode: expected } });
  });

  it.each([undefined, "not_found"])("delete not-found is terminal success (code %j)", async errorCode => {
    const f = await fixture(); const deviceId = await create(f);
    await roster(f, deviceId);
    const opId = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId, opType: "deleteUser", payload: { ideUserId: 123 } });
    await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 42 });
    await f.t.mutation(internal.ideSync.markAck, { opId, msxId: 42, result: "fail", errorCode, message: errorCode ? "record missing" : "record not found" });
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "acked" });
    expect(await f.t.run(ctx => ctx.db.query("idePanelUsers").collect())).toEqual([]);
  });
});
