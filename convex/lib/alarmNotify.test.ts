import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { isFreshAlarmEvent, notifyAlarmIfNeeded } from "./alarmNotify";

const state = vi.hoisted(() => ({ events: [] as Array<Record<string, unknown>>, scheduled: 0 }));
vi.mock("../_generated/api", () => ({ internal: { actions: { sendAlarmEmail: { send: "send" } } } }));

function createCtx() {
  const db = {
    get: vi.fn(async (id: string) => state.events.find(event => event._id === id) ?? null),
    patch: vi.fn(async (id: string, changes: Record<string, unknown>) => {
      const event = state.events.find(item => item._id === id);
      if (event) Object.assign(event, changes);
    }),
    query: vi.fn((table: string) => ({
      withIndex: (_name: string, build: (query: { eq: (field: string, value: unknown) => unknown; gte: (field: string, value: unknown) => unknown }) => unknown) => {
        const constraints: Array<[string, string, unknown]> = [];
        const query = {
          eq: (field: string, value: unknown) => { constraints.push(["eq", field, value]); return query; },
          gte: (field: string, value: unknown) => { constraints.push(["gte", field, value]); return query; },
        };
        build(query);
        return {
          unique: async () => table === "alarmSettings" ? { emailEnabled: true, recipients: ["ops@example.com"], minSeverity: "warning" } : null,
          order: () => ({ take: async () => state.events.filter(event => constraints.every(([op, field, value]) => op === "eq" ? event[field] === value : String(event[field]) >= String(value))) }),
        };
      },
    })),
  };
  const scheduler = { runAfter: vi.fn(async () => { state.scheduled += 1; }) };
  return { db, scheduler } as unknown as MutationCtx;
}

function row(id: string, overrides: Record<string, unknown> = {}) {
  return { _id: id, projectId: "p1", deviceId: "d1", eventTime: new Date().toISOString(), category: "alarm", severity: "warning", label: "Kapı zorlandı", ...overrides };
}

beforeEach(() => { state.events = []; state.scheduled = 0; });

describe("notifyAlarmIfNeeded", () => {
  it("does not send stale alarms or schedule the same event twice", async () => {
    state.events = [row("stale", { eventTime: new Date(Date.now() - 11 * 60_000).toISOString() }), row("live")];
    const ctx = createCtx();
    await notifyAlarmIfNeeded(ctx, "stale" as Id<"deviceEvents">);
    await notifyAlarmIfNeeded(ctx, "live" as Id<"deviceEvents">);
    await notifyAlarmIfNeeded(ctx, "live" as Id<"deviceEvents">);
    expect(state.scheduled).toBe(1);
    expect(state.events[1]?.alarmNotifiedAt).toBeUndefined();
    expect(state.events[1]?.alarmEmailStatus).toBe("queued");
  });

  it("records scheduler failure without a misleading sent stamp", async () => {
    state.events = [row("live")];
    const ctx = createCtx();
    vi.mocked(ctx.scheduler.runAfter).mockRejectedValueOnce(new Error("schedule failed"));
    await notifyAlarmIfNeeded(ctx, "live" as Id<"deviceEvents">);
    expect(state.events[0]).toMatchObject({ alarmEmailStatus: "failed", alarmEmailError: "Alarm e-postası zamanlanamadı" });
    expect(state.events[0]?.alarmNotifiedAt).toBeUndefined();
    expect(state.events[0]?.alarmQueuedAt).toBeUndefined();
  });
  it("stamps only the first matching event within ten minutes", async () => {
    state.events = [row("e1"), row("e2")];
    const ctx = createCtx();
    await notifyAlarmIfNeeded(ctx, "e1" as Id<"deviceEvents">);
    await notifyAlarmIfNeeded(ctx, "e2" as Id<"deviceEvents">);
    expect(state.events[0]?.alarmQueuedAt).toEqual(expect.any(String));
    expect(state.events[1]?.alarmQueuedAt).toBeUndefined();
    expect(state.scheduled).toBe(1);
  });

  it.each(["Arıza: cihaz çevrimdışı", "Kapı zorlandı"])("debounces %s per device and preserves label/category separation", async label => {
    state.events = [row("e1", { label }), row("e2", { label, deviceId: "d2" }), row("duplicate", { label }), row("otherLabel", { label: "Başka alarm" }), row("otherCategory", { label, category: "exception" })];
    const ctx = createCtx();
    for (const id of ["e1", "e2", "duplicate", "otherLabel", "otherCategory"]) await notifyAlarmIfNeeded(ctx, id as Id<"deviceEvents">);
    expect(state.scheduled).toBe(4);
    expect(state.events[2]?.alarmQueuedAt).toBeUndefined();
    expect(state.events[1]?.alarmEmailStatus).toBe("queued");
  });

  it("serializes competing event mutations so exactly one is scheduled", async () => {
    state.events = [row("e1"), row("e2")];
    const ctx = createCtx();
    let transaction = Promise.resolve();
    const runMutation = (id: string) => {
      const next = transaction.then(() => notifyAlarmIfNeeded(ctx, id as Id<"deviceEvents">));
      transaction = next.then(() => undefined);
      return next;
    };
    await Promise.all([runMutation("e1"), runMutation("e2")]);
    expect(state.scheduled).toBe(1);
    expect(state.events.filter(event => event.alarmQueuedAt !== undefined)).toHaveLength(1);
  });

  it("allows another notification after the prior stamp is older than ten minutes", async () => {
    state.events = [row("old", { eventTime: new Date(Date.now() - 11 * 60_000).toISOString(), alarmNotifiedAt: new Date(Date.now() - 11 * 60_000).toISOString() }), row("new")];
    await notifyAlarmIfNeeded(createCtx(), "new" as Id<"deviceEvents">);
    expect(state.scheduled).toBe(1);
  });

  it("ignores a stale notification stamp even when the event time looks recent (device clock ahead)", async () => {
    const future = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    state.events = [row("future", { eventTime: future, alarmNotifiedAt: new Date(Date.now() - 11 * 60_000).toISOString() }), row("live")];
    await notifyAlarmIfNeeded(createCtx(), "live" as Id<"deviceEvents">);
    expect(state.scheduled).toBe(1);
  });
});

describe("isFreshAlarmEvent", () => {
  const now = Date.parse("2026-10-20T06:00:00.000Z");
  it("accepts events inside the ten minute window", () => {
    expect(isFreshAlarmEvent("2026-10-20T05:51:00.000Z", now)).toBe(true);
  });
  it("rejects backfilled events older than the window and invalid times", () => {
    expect(isFreshAlarmEvent("2026-10-20T05:49:59.000Z", now)).toBe(false);
    expect(isFreshAlarmEvent("2026-10-19T02:00:00.000Z", now)).toBe(false);
    expect(isFreshAlarmEvent("not-a-date", now)).toBe(false);
  });
  it("rejects future events beyond the clock skew allowance", () => {
    expect(isFreshAlarmEvent("2026-10-20T06:01:30.000Z", now)).toBe(true);
    expect(isFreshAlarmEvent("2026-10-20T06:03:00.000Z", now)).toBe(false);
    expect(isFreshAlarmEvent("2026-10-21T06:00:00.000Z", now)).toBe(false);
  });
});
