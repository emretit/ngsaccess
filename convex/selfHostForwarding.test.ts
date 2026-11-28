// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { gatewayApiCall } from "./lib/gateway/core";
import { setHttpHostForwarding } from "./lib/gateway/devices";
vi.mock("./lib/gateway/core", () => ({ gatewayApiCall: vi.fn(async () => ({ status: 200, raw: "https://old.example/card-reader?token=SECRET", data: {} })) }));
vi.mock("./lib/gateway/devices", () => ({ setHttpHostForwarding: vi.fn(async () => ({ ok: true })) }));
vi.mock("./lib/gatewayCommand", () => ({ auditDeviceCommand: async (_ctx: unknown, _device: unknown, _label: unknown, run: () => Promise<unknown>) => run() }));
const modules = import.meta.glob("./**/*.ts");
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it.each([false, true])("forwarding only writes when explicitly requested (%s)", async write => {
  vi.stubEnv("SELF_HOST_TARGET", write ? "1" : "");
  vi.stubEnv("CONVEX_SITE_URL", "https://site.example");
  vi.stubEnv("HIK_FORWARDING_URL", "https://site.example/card-reader");
  const t = convexTest(schema, modules);
  const fixture = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 60000 });
    const deviceId = await ctx.db.insert("devices", { name: "Hik", hikDevIndex: "dev", apiToken: "device-secret", createdAt: "", updatedAt: "" });
    await ctx.db.insert("devices", { name: "Untouched", hikDevIndex: "other", apiToken: "other-secret", createdAt: "", updatedAt: "" });
    return { identity: { subject: `${userId}|${sessionId}` }, deviceId };
  });
  const result = await t.withIdentity(fixture.identity).action(api.actions.selfHostForwarding.forwarding, write ? { write: true, confirmHost: "site.example", deviceIds: [fixture.deviceId] } : {});
  expect(gatewayApiCall).toHaveBeenCalledWith("/ISAPI/Event/notification/httpHosts", "GET", undefined, "dev");
  expect(result.rows[0]?.before).not.toContain("SECRET");
  expect(setHttpHostForwarding).toHaveBeenCalledTimes(write ? 1 : 0);
  expect(result.rows[0]?.written).toBe(write);
  expect(result.rows[1]?.written).toBe(false);
  if (write) expect(setHttpHostForwarding).toHaveBeenCalledWith("dev", expect.stringContaining("https://site.example/card-reader?token="));
});

it.each(["flag", "cloud", "confirmation", "devices", "emptyDevices", "destination"])("forwarding refuses writes before any device I/O when %s is invalid", async invalid => {
  vi.stubEnv("SELF_HOST_TARGET", invalid === "flag" ? "0" : "1");
  vi.stubEnv("CONVEX_SITE_URL", invalid === "cloud" ? "https://old.convex.site" : "https://site.example");
  vi.stubEnv("HIK_FORWARDING_URL", invalid === "destination" ? "https://other.example/card-reader" : "https://site.example/card-reader");
  const t = convexTest(schema, modules);
  const fixture = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 60000 });
    const deviceId = await ctx.db.insert("devices", { name: "Hik", hikDevIndex: "dev", createdAt: "", updatedAt: "" });
    return { identity: { subject: `${userId}|${sessionId}` }, deviceId };
  });
  await expect(t.withIdentity(fixture.identity).action(api.actions.selfHostForwarding.forwarding, {
    write: true,
    confirmHost: invalid === "confirmation" ? undefined : invalid === "cloud" ? "old.convex.site" : "site.example",
    deviceIds: invalid === "devices" ? undefined : invalid === "emptyDevices" ? [] : [fixture.deviceId],
  })).rejects.toThrow();
  expect(gatewayApiCall).not.toHaveBeenCalled();
  expect(setHttpHostForwarding).not.toHaveBeenCalled();
  expect(await t.run(ctx => ctx.db.query("deviceEvents").collect())).toHaveLength(0);
});
