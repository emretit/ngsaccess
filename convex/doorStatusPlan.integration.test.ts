// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { DoorStatusPlan } from "./lib/doorStatusPlan";
const wire = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("./lib/gateway/core", () => ({ gatewayApiCallChecked: wire.send }));
const modules = import.meta.glob("./**/*.ts");
const legacy: DoorStatusPlan = {
  enabled: true,
  beginTime: "08:00:00",
  endTime: "18:00:00",
  mode: "remainOpen",
};
const weekly: DoorStatusPlan = {
  ...legacy,
  weekly: [
    {
      day: "Monday",
      segments: [
        { beginTime: "09:00", endTime: "12:00", mode: "remainClosed" },
        { beginTime: "13:00", endTime: "17:00", mode: "normal" },
      ],
    },
    { day: "Sunday", segments: [] },
  ],
};
async function fixture(plan: DoorStatusPlan) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      role: "super_admin",
      verified: true,
    });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 100000,
    });
    const projectId = await ctx.db.insert("projects", { name: "Test" });
    const deviceId = await ctx.db.insert("devices", {
      projectId,
      name: "Panel",
      brand: "hikvision",
      hikTransport: "gateway",
      hikDevIndex: "test-index",
      hikLastSeenAt: Date.now(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const doorId = await ctx.db.insert("doors", {
      projectId,
      deviceId,
      name: "Kapı",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      hikDoorNo: 2,
      hikDoorStatusPlan: plan,
    });
    return { userId, sessionId, projectId, deviceId, doorId };
  });
  return {
    t,
    caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }),
    ...ids,
  };
}
beforeEach(() => wire.send.mockReset().mockResolvedValue({ ok: true }));
describe("kapı durum planı gateway zinciri", () => {
  it.each(["direct", "queue"] as const)(
    "%s: eski, haftalık ve kapalı planı mock gateway'e gönderir",
    async (route) => {
      for (const plan of [legacy, weekly, { ...weekly, enabled: false }]) {
        wire.send.mockClear();
        const { t, caller, doorId, deviceId } = await fixture(plan);
        if (route === "direct")
          expect(
            await caller.action(
              api.actions.hikGatewayDevice.applyDoorStatusPlan,
              { doorId },
            ),
          ).toEqual({ ok: true });
        else {
          await t.run((ctx) =>
            ctx.db.insert("hikPendingOperations", {
              deviceId,
              operation: "syncDoorStatusPlan",
              payload: { doorId },
              status: "failed",
              attemptCount: 0,
              createdAt: Date.now(),
            }),
          );
          expect(
            await t.action(internal.actions.hikQueueWorker.processHikQueue, {}),
          ).toEqual({ retried: 1, ok: 1, failed: 0 });
        }
        const link = [
          "/ISAPI/AccessControl/DoorStatusPlan/2",
          "PUT",
          { DoorStatusPlan: { templateNo: plan.enabled ? 102 : 0 } },
          "test-index",
        ];
        expect(wire.send).toHaveBeenLastCalledWith(...link);
        expect(wire.send).toHaveBeenCalledTimes(plan.enabled ? 3 : 1);
        if (plan.enabled) {
          const cfg = wire.send.mock.calls[0]?.[2] as {
            DoorStatusWeekPlanCfg: {
              enable: boolean;
              WeekPlanCfg: Array<{
                week: string;
                id: number;
                enable: boolean;
                doorStatus: string;
                TimeSegment: { beginTime: string; endTime: string };
              }>;
            };
          };
          const active = cfg.DoorStatusWeekPlanCfg.WeekPlanCfg.filter(
            (item) => item.enable,
          );
          expect(cfg.DoorStatusWeekPlanCfg.WeekPlanCfg).toHaveLength(56);
          if (plan.weekly)
            expect(active).toEqual([
              {
                week: "Monday",
                id: 1,
                enable: true,
                doorStatus: "remainClosed",
                TimeSegment: { beginTime: "09:00:00", endTime: "12:00:00" },
              },
              {
                week: "Monday",
                id: 2,
                enable: true,
                doorStatus: "normal",
                TimeSegment: { beginTime: "13:00:00", endTime: "17:00:00" },
              },
            ]);
          else
            expect(active).toEqual(
              [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((week) => ({
                week,
                id: 1,
                enable: true,
                doorStatus: "remainOpen",
                TimeSegment: { beginTime: "08:00:00", endTime: "18:00:00" },
              })),
            );
          expect(wire.send.mock.calls[1]).toEqual([
            "/ISAPI/AccessControl/DoorStatusPlanTemplate/102",
            "PUT",
            {
              DoorStatusPlanTemplate: {
                enable: true,
                templateNo: 102,
                weekPlanNo: 2,
                holidayGroupNo: "",
              },
            },
            "test-index",
          ]);
        }
      }
    },
  );
  it("doors.update geçersiz weekly reddeder ve kayıt değişmez", async () => {
    const { t, caller, doorId } = await fixture(legacy);
    const bad = {
      ...legacy,
      weekly: [
        {
          day: "Monday" as const,
          segments: [
            { beginTime: "12:00", endTime: "09:00", mode: "normal" as const },
          ],
        },
      ],
    };
    await expect(
      caller.mutation(api.doors.update, { doorId, hikDoorStatusPlan: bad }),
    ).rejects.toThrow("Başlangıç");
    expect(
      (await t.run((ctx) => ctx.db.get(doorId)))?.hikDoorStatusPlan,
    ).toEqual(legacy);
  });
  it("create ve update ilk segmenti normalize eder, create geçersiz planı reddeder", async () => {
    const { t, caller, doorId, projectId } = await fixture(legacy);
    const created = await caller.mutation(api.doors.create, {
      name: "Yeni",
      projectId,
      hikDoorStatusPlan: weekly,
    });
    await caller.mutation(api.doors.update, {
      doorId,
      hikDoorStatusPlan: weekly,
    });
    for (const id of [created, doorId])
      expect(
        (await t.run((ctx) => ctx.db.get(id)))?.hikDoorStatusPlan,
      ).toMatchObject({
        beginTime: "09:00:00",
        endTime: "12:00:00",
        mode: "remainClosed",
      });
    await expect(
      caller.mutation(api.doors.create, {
        name: "Hatalı",
        projectId,
        hikDoorStatusPlan: { ...legacy, beginTime: "bad" },
      }),
    ).rejects.toThrow("Saat");
  });
});
