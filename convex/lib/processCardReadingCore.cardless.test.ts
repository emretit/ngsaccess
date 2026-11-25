import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { processCardReadingCore } from "./processCardReadingCore";
import { pdksFirstRecordDate } from "./pdksAvailability";
import { buildPdksWorkDateResolver } from "./pdksWorkDay";
import { buildPdksEmployeeReadingMap } from "./pdksTable";
import { dashboardWorkDateResolver } from "../dashboard";
import type { ShiftResolver } from "./shiftResolver";
import { loadRuleReportDays } from "./reportAttendance";

const projectId = "project" as Id<"projects">;
const people: Doc<"employees">[] = ["A", "B"].map(id => ({
  _id: id as Id<"employees">, _creationTime: 0, projectId, firstName: id, lastName: "Kişi", cardNumber: "", email: "", isActive: true,
}));
const unknownReading: Doc<"cardReadings"> = {
  _id: "reading" as Id<"cardReadings">, _creationTime: 0, projectId, cardNo: "", accessTime: "2026-11-01T01:00:00Z", accessStatus: "izin_verildi", direction: "exit", hikCurrentVerifyMode: "card",
};
const emptyHistory = { db: { query: () => {
  const chain = { withIndex: () => chain, order: () => chain, take: async () => [] };
  return chain;
} } } as unknown as QueryCtx;

describe("empty cards never identify people", () => {
  it.each(["hikvision", "ide_smart", "other"] as const)("does not consult the employee matcher for blank %s events", async brand => {
    for (const cardNo of ["", "  "]) {
      const device = { _id: "device" as Id<"devices">, brand, projectId, name: "Panel", accessDirection: "entry" };
      const insert = vi.fn(async (_table: string, _value: Record<string, unknown>) => "reading");
      const ctx = { db: { query: () => ({ first: async () => ({ _id: projectId }) }), get: async () => device, insert } } as unknown as MutationCtx;
      const findEmployee = vi.fn(async () => people[0]);
      await processCardReadingCore(ctx, { cardNo, deviceSerial: "", authedDeviceId: device._id, hikCurrentVerifyMode: "card" }, findEmployee);
      expect(findEmployee).not.toHaveBeenCalled();
      expect(insert).toHaveBeenCalledWith("cardReadings", expect.objectContaining({ cardNo }));
      expect(insert.mock.calls[0]?.[1].employeeId).toBeUndefined();
    }
  });

  it("retains the employee matcher for a real card and its leading zeroes", async () => {
    const device = { _id: "device" as Id<"devices">, brand: "hikvision", projectId, name: "Panel", accessDirection: "entry" };
    const insert = vi.fn(async () => "reading");
    const ctx = { db: { query: () => ({ first: async () => ({ _id: projectId }) }), get: async () => device, insert } } as unknown as MutationCtx;
    const findEmployee = vi.fn(async () => people[0]);
    await processCardReadingCore(ctx, { cardNo: "00123", deviceSerial: "", authedDeviceId: device._id }, findEmployee);
    expect(findEmployee).toHaveBeenCalledWith(ctx, "00123", projectId);
    expect(insert).toHaveBeenCalledWith("cardReadings", expect.objectContaining({ employeeId: people[0]._id }));
  });

  it("two cardless people have no attendance or first-record evidence from an anonymous empty-card event", async () => {
    const map = buildPdksEmployeeReadingMap({ employees: people, readings: [unknownReading] });
    for (const person of people) {
      expect(map.get(person._id)).toEqual([]);
      expect(await pdksFirstRecordDate(emptyHistory, person, [unknownReading])).toBeNull();
    }
    const identified = { ...unknownReading, employeeId: people[0]._id };
    expect(await pdksFirstRecordDate(emptyHistory, people[0], [identified])).toBe("2026-11-01");
    expect(await pdksFirstRecordDate(emptyHistory, people[1], [identified])).toBeNull();
  });

  it("a nonempty legacy card still provides first-record evidence, but never overrides another employeeId", async () => {
    const person = { ...people[0], cardNumber: "00123" };
    const reading = { ...unknownReading, cardNo: "00123" };
    expect(await pdksFirstRecordDate(emptyHistory, person, [reading])).toBe("2026-11-01");
    expect(await pdksFirstRecordDate(emptyHistory, person, [{ ...reading, employeeId: people[1]._id }])).toBeNull();
    expect(await pdksFirstRecordDate(emptyHistory, person, [{ ...reading, cardNo: "123" }])).toBeNull();
    expect(await pdksFirstRecordDate(emptyHistory, person, [{ ...reading, cardNo: " 00123 " }])).toBeNull();
  });

  it("work-day and dashboard resolvers do not use blank cards or fall back from an unknown employeeId", () => {
    const resolve = vi.fn(() => null);
    const resolvePlan = vi.fn(() => ({ kind: "none" as const, source: "project" as const }));
    const shifts: ShiftResolver = { shifts: new Map(), resolve, resolveLast: resolve, resolvePlan };
    const workDate = buildPdksWorkDateResolver(people, resolve);
    const dashboardDate = dashboardWorkDateResolver(people, shifts, () => "wrong");
    for (const reading of [unknownReading, { ...unknownReading, employeeId: "absent" as Id<"employees"> }]) {
      expect(workDate(reading)).toBe("2026-11-01");
      expect(dashboardDate(reading)).toBe("2026-11-01");
    }
    expect(resolve).not.toHaveBeenCalled();
    expect(resolvePlan).not.toHaveBeenCalled();
    const real = { ...people[0], cardNumber: "00123" };
    dashboardWorkDateResolver([real], shifts, () => "wrong")({ ...unknownReading, cardNo: "00123" });
    expect(resolvePlan).toHaveBeenCalled();
    expect(resolve).toHaveBeenCalled();
  });

  it("attendance report plan discovery excludes an anonymous blank card but retains real legacy cards", async () => {
    const shift: Doc<"shifts"> = { _id: "shift" as Id<"shifts">, _creationTime: 0, projectId, name: "Vardiya", startTime: "09:00", endTime: "18:00", createdAt: "", updatedAt: "" };
    const shifts: ShiftResolver = { shifts: new Map([[shift._id, shift]]), resolve: () => shift, resolveLast: () => shift,
      resolvePlan: () => ({ kind: "shifts", source: "employee", calendar: "plan", origin: "weekly", shifts: [shift] }) };
    const ctx = { db: { query: () => {
      const chain = { withIndex: () => chain, order: () => chain, take: async () => [], collect: async () => [], first: async () => null };
      return chain;
    } } } as unknown as QueryCtx;
    const options = { preloadedEmployees: people, shiftResolver: shifts,
      preloadedReadings: { readings: [unknownReading], startISO: "2026-10-01T00:00:00Z", endISO: "2026-12-01T00:00:00Z" } };
    const report = await loadRuleReportDays(ctx, [projectId], "2026-11-01", "2026-11-01", options);
    expect(report.readings).toEqual([]);
    const cardReading = { ...unknownReading, cardNo: "00123" };
    const cardReport = await loadRuleReportDays(ctx, [projectId], "2026-11-01", "2026-11-01", { ...options,
      preloadedEmployees: [{ ...people[0], cardNumber: "00123" }], preloadedReadings: { ...options.preloadedReadings, readings: [cardReading] } });
    expect(cardReport.readings).toEqual([cardReading]);
  });
});
