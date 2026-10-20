import { describe, it, expect } from "vitest";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { defaultDoorName, readerDirectionFromIo, deleteGroupDoorsForDoor, purgeDeviceCascade } from "./deviceHelpers";

describe("deviceHelpers – defaultDoorName", () => {
  it("0-indeksli io → 1-indeksli ad", () => {
    expect(defaultDoorName(0)).toBe("Kapı 1");
    expect(defaultDoorName(3)).toBe("Kapı 4");
  });
});

describe("deviceHelpers – readerDirectionFromIo", () => {
  it("io 0 → entry, 1 → exit, diğer → both", () => {
    expect(readerDirectionFromIo(0)).toBe("entry");
    expect(readerDirectionFromIo(1)).toBe("exit");
    expect(readerDirectionFromIo(2)).toBe("both");
    expect(readerDirectionFromIo(5)).toBe("both");
  });
});


type Row = { _id: string } & Record<string, unknown>;

/** Bellek içi sahte DB: withIndex eşitlik kısıtları, take/collect, get, delete. */
function fakeDb(tables: Record<string, Row[]>) {
  const find = (id: string) => Object.values(tables).flatMap(rows => rows).find(row => row._id === id) ?? null;
  const db = {
    get: async (id: string) => find(id),
    delete: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const index = rows.findIndex(row => row._id === id);
        if (index >= 0) rows.splice(index, 1);
      }
    },
    query: (table: string) => ({
      withIndex: (_name: string, build: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
        const constraints: Array<[string, unknown]> = [];
        const q = { eq: (field: string, value: unknown) => { constraints.push([field, value]); return q; } };
        build(q);
        const rows = () => (tables[table] ?? []).filter(row => constraints.every(([field, value]) => row[field] === value));
        return { collect: async () => rows(), take: async (n: number) => rows().slice(0, n) };
      },
    }),
  };
  return { ctx: { db } as unknown as MutationCtx, tables };
}

function cascadeFixture() {
  const groupDoors: Row[] = Array.from({ length: 205 }, (_, i) => ({ _id: `gdA${i}`, doorId: "doorA", groupId: "rule" }));
  groupDoors.push({ _id: "gdB", doorId: "doorB", groupId: "rule" }, { _id: "gdOther", doorId: "otherDoor", groupId: "rule" });
  return fakeDb({
    devices: [{ _id: "device", projectId: "p1" }, { _id: "otherDevice" }],
    doors: [{ _id: "doorA", deviceId: "device" }, { _id: "doorB", deviceId: "device" }, { _id: "otherDoor", deviceId: "otherDevice" }],
    readers: [{ _id: "rA", doorId: "doorA" }, { _id: "rB", doorId: "doorB" }],
    groupDevices: [{ _id: "gdev", projectId: "p1", deviceId: "device", groupId: "rule" }],
    groupDoors,
    hikPendingOperations: [],
  });
}

describe("deviceHelpers – groupDoors cascade", () => {
  it("cleans all 205 links across batches and is idempotent", async () => {
    const { ctx, tables } = cascadeFixture();
    await deleteGroupDoorsForDoor(ctx, "doorA" as Id<"doors">);
    await deleteGroupDoorsForDoor(ctx, "doorA" as Id<"doors">);
    expect(tables.groupDoors.map(link => link._id)).toEqual(["gdB", "gdOther"]);
    expect(tables.doors.map(door => door._id)).toContain("doorA");
  });

  it("purges owned doors, links and readers while preserving another device", async () => {
    const { ctx, tables } = cascadeFixture();
    await purgeDeviceCascade(ctx, "device" as Id<"devices">, "p1" as Id<"projects">);
    expect(tables.devices.map(row => row._id)).toEqual(["otherDevice"]);
    expect(tables.doors.map(row => row._id)).toEqual(["otherDoor"]);
    expect(tables.groupDoors.map(row => row._id)).toEqual(["gdOther"]);
    expect(tables.readers).toEqual([]);
    expect(tables.groupDevices).toEqual([]);
  });
});
