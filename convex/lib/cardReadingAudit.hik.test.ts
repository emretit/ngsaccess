import { describe, expect, it, vi } from "vitest";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { enrichReadingsForList } from "./cardReadingAudit";
import { hikDoorReaderNumbers } from "./hikDoorReaders";
import { getPlanReaders } from "../doors";
import type { Id } from "../_generated/dataModel";

type Row = Record<string, unknown>;
function fixture(doors: Row[], readers: Row[]) {
  const queries = vi.fn();
  const takes = vi.fn();
  const ctx = { db: {
    get: async (id: string) => ({ _id: id, projectId: "p", brand: id === "ide" ? "ide_smart" : "hikvision" }),
    query: (table: string) => ({ withIndex: (index: string, build: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
      let deviceId = "";
      build({ eq: (_field, value) => { deviceId = value; } });
      queries(table, index, deviceId);
      const rows = (table === "doors" ? doors : readers).filter(row => row.deviceId === deviceId);
      return { take: async (limit: number) => { takes(table, limit); return rows.slice(0, limit); }, collect: async () => rows };
    } }),
  } } as unknown as QueryCtx;
  const reading = (readerNo: number, overrides: Row = {}) => ({ _id: String(readerNo), projectId: "p", deviceId: "hik", cardNo: "1", accessTime: "2026-11-25T09:00:00Z", hikCardReaderNo: readerNo, ...overrides }) as unknown as Doc<"cardReadings">;
  return { ctx, queries, takes, reading };
}
const door = (id: string, no: number, extra: Row = {}) => ({ _id: id, name: id, projectId: "p", deviceId: "hik", hikDoorNo: no, ...extra });

describe("Hik live enrichment", () => {
  it("maps custom readers, missing-number/both readers and readerless doors once per device", async () => {
    const f = fixture([door("custom", 1), door("legacy", 2), door("readerless", 3)], [
      { doorId: "custom", projectId: "p", deviceId: "hik", hikReaderNo: 9, direction: "both" },
      { doorId: "legacy", projectId: "p", deviceId: "hik", direction: "both" },
    ]);
    const result = await enrichReadingsForList(f.ctx, [9, 9, 3, 4, 5, 6, 1].map(n => f.reading(n)));
    expect(result.map(r => r.door?.name ?? null)).toEqual(["custom", "custom", "legacy", "legacy", "readerless", "readerless", null]);
    expect(f.queries.mock.calls).toEqual([["doors", "by_device", "hik"], ["readers", "by_device", "hik"]]);
    expect(f.takes.mock.calls).toEqual([["doors", 101], ["readers", 201]]);
  });
  it("does not cross projects or guess an ambiguous reader address", async () => {
    const f = fixture([door("a", 1), door("b", 1), door("foreign", 2, { projectId: "foreign" })], []);
    const result = await enrichReadingsForList(f.ctx, [f.reading(1), f.reading(3), f.reading(1, { projectId: "foreign" })]);
    expect(result.map(r => r.door)).toEqual([null, null, null]);
  });
  it("keeps IDE IO zero matching and performs no Hik lookup for IDE rows", async () => {
    const f = fixture([door("ide-door", 1, { deviceId: "ide", ioId: 0 })], []);
    const result = await enrichReadingsForList(f.ctx, [f.reading(1, { deviceId: "ide", ideIoId: 0 })]);
    expect(result[0]?.door?.name).toBe("ide-door");
    expect(f.queries.mock.calls).toEqual([["doors", "by_device", "ide"]]);
  });
  it.each(["doors", "readers"])("fails explicitly at the bounded %s limit", async table => {
    const f = fixture(table === "doors" ? Array.from({ length: 101 }, (_, i) => door(String(i), i + 1)) : [door("a", 1)], table === "readers" ? Array.from({ length: 201 }, () => ({ deviceId: "hik" })) : []);
    await expect(enrichReadingsForList(f.ctx, [f.reading(1)])).rejects.toThrow("100 kapı / 200 okuyucu");
  });
  it("bounds the total mapping rows across many devices in one request", async () => {
    const doors = Array.from({ length: 1100 }, (_, i) => door(String(i), i % 100 + 1, { deviceId: `hik-${Math.floor(i / 100)}` }));
    const f = fixture(doors, []);
    const rows = Array.from({ length: 11 }, (_, i) => f.reading(1, { deviceId: `hik-${i}` }));
    await expect(enrichReadingsForList(f.ctx, rows)).rejects.toThrow("1000 kapı / 2000 okuyucu");
    const doorCalls = f.takes.mock.calls.filter(call => call[0] === "doors");
    expect(doorCalls[doorCalls.length - 1]).toEqual(["doors", 1]);
  });
});

describe("shared Hik door reader addressing", () => {
  it("defaults to door 1 and expands unnumbered both while retaining explicit custom numbers", () => {
    const address = { projectId: undefined, deviceId: undefined, hikDoorNo: undefined };
    expect(hikDoorReaderNumbers(address, [])).toEqual([1, 2]);
    expect(hikDoorReaderNumbers(address, [{ ...address, direction: "both", hikReaderNo: undefined }])).toEqual([1, 2]);
    expect(hikDoorReaderNumbers(address, [{ ...address, direction: "both", hikReaderNo: 17 }])).toEqual([17]);
  });
  it("keeps a single reader number for both-direction plan delivery", async () => {
    const handler = (getPlanReaders as unknown as { _handler: (ctx: QueryCtx, args: { doorId: Id<"doors"> }) => Promise<number[]> })._handler;
    const ctx = { db: {
      get: async () => door("legacy", 2),
      query: () => ({ withIndex: () => ({ take: async () => [{ projectId: "p", deviceId: "hik", direction: "both" }] }) }),
    } } as unknown as QueryCtx;
    expect(await handler(ctx, { doorId: "legacy" as Id<"doors"> })).toEqual([3]);
  });
});
