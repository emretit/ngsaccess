import type { Id } from "../_generated/dataModel";
import { importPdksCsv } from "../actions/pdksImport";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { bulkUpsertManual } from "../pdksRecords";
import { writeAudit } from "./audit";
import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { validateManualPdksInput } from "./pdksManual";
const input = { date: "2026-10-16", entryTime: "09:00", note: "  Kart unutuldu  " };
describe("zorunlu manuel düzeltme gerekçesi", () => {
  it.each([undefined, "", "   ", "ab", "a".repeat(501)])("geçersiz gerekçe reddedilir", note => {
    expect(() => validateManualPdksInput({ ...input, note })).toThrow(ConvexError);
    expect(() => validateManualPdksInput({ ...input, note })).toThrow("Gerekçe 3–500 karakter olmalı");
  });
  it("trim edilmiş 3–500 karakter ve tek saat kabul edilir", () => {
    expect(validateManualPdksInput(input)).toEqual({ note: "Kart unutuldu", entryTime: "09:00", exitTime: undefined });
    expect(validateManualPdksInput({ ...input, note: " abc ", entryTime: undefined, exitTime: "18:00" }).note).toBe("abc");
    expect(validateManualPdksInput({ ...input, note: "a".repeat(500) }).note).toHaveLength(500);
  });
  it("iki boş saat ve gece yarısını aşan çıkış reddedilir", () => {
    expect(() => validateManualPdksInput({ ...input, entryTime: " " })).toThrow("En az bir saat girin");
    expect(() => validateManualPdksInput({ ...input, entryTime: "22:00", exitTime: "06:00" })).toThrow("Çıkış saati giriş saatinden sonra olmalı");
    expect(() => validateManualPdksInput({ ...input, entryTime: "25:00" })).toThrow("Geçersiz giriş saati");
  });
});

// Real mutation handler with auth/audit adapters replaced; no DB/network access.
vi.mock("./customFunctions", () => ({
  adminMutation: (config: unknown) => config, authedQuery: (config: unknown) => config,
}));
vi.mock("./audit", () => ({ writeAudit: vi.fn() }));
const bulkHandler = (bulkUpsertManual as unknown as {
  handler: (ctx: MutationCtx, args: {
    note: string;
    rows: Array<{ employeeId: Id<"employees">; date: string; entryTime?: string; exitTime?: string; note?: string }>;
  }) => Promise<{ inserted: number; updated: number; errors: Array<{ index: number; message: string }> }>;
}).handler;

function manualContext() {
  const existingId = "existing" as Id<"pdksRecords">;
  const patch = vi.fn(async () => undefined);
  const insert = vi.fn(async () => "inserted" as Id<"pdksRecords">);
  let date: unknown;
  const index = {
    eq: (_field: string, value: unknown) => { date = value; return index; },
  };
  const chain = {
    withIndex: (_name: string, fn: (q: typeof index) => unknown) => { fn(index); return chain; },
    collect: async () => [],
    first: async () => date === "2026-10-17" ? { _id: existingId } : null,
  };
  const ctx = {
    user: { _id: "admin", role: "super_admin" },
    db: { get: async () => ({ _id: "emp", firstName: "Test", lastName: "Personel" }), query: () => chain, insert, patch },
  } as unknown as MutationCtx;
  return { ctx, patch, insert };
}

describe("bulk manual validation and audit", () => {
  it("batch gerekçesi zorunlu; geçersiz batch hiçbir satır yazmaz", async () => {
    const { ctx, insert, patch } = manualContext();
    for (const note of ["", " ab ", "a".repeat(501)]) {
      await expect(bulkHandler(ctx, { note, rows: [] })).rejects.toThrow("Gerekçe 3–500 karakter olmalı");
    }
    expect(insert).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });
  it("boş/ters saatli satır hata verir, geçerli satırlar ortak gerekçeyle present yazılır", async () => {
    vi.mocked(writeAudit).mockClear();
    const { ctx, insert, patch } = manualContext();
    const base = { employeeId: "emp" as Id<"employees">, date: "2026-10-16" };
    const result = await bulkHandler(ctx, { note: "  Kart unutuldu  ", rows: [
      { ...base, entryTime: " ", exitTime: " " },
      { ...base, entryTime: "22:00", exitTime: "06:00" },
      { ...base, exitTime: " 18:00 ", note: "Satır gerekçesi kullanılmaz" },
      { ...base, date: "2026-10-17", entryTime: " 09:00 " },
    ] });
    expect(result).toMatchObject({ inserted: 1, updated: 1, errors: [
      { index: 0, message: expect.stringContaining("En az bir saat girin") },
      { index: 1, message: expect.stringContaining("Çıkış saati giriş saatinden sonra olmalı") },
    ] });
    expect(insert).toHaveBeenCalledWith("pdksRecords", expect.objectContaining({
      entryTime: undefined, exitTime: "18:00", status: "present", manualNote: "Kart unutuldu", manualEntry: true,
    }));
    expect(patch).toHaveBeenCalledWith("existing", expect.objectContaining({
      entryTime: "09:00", exitTime: undefined, status: "present", manualNote: "Kart unutuldu", manualEntry: true,
    }));
    expect(writeAudit).toHaveBeenCalledWith(ctx, expect.objectContaining({
      note: "Kart unutuldu", newValue: { inserted: 1, updated: 1, errors: 2, touched: 2 },
    }));
  });
});

const importHandler = (importPdksCsv as unknown as {
  _handler: (ctx: ActionCtx, args: { csvText: string; note: string }) => Promise<{ inserted: number; updated: number; errors: number }>;
})._handler;
it("CSV action batch gerekçesini doğrular ve trim ederek mutation'a geçirir", async () => {
  const runAction = vi.fn(async () => ({
    rows: [{ employeeId: "emp", date: "2026-10-16", exitTime: "18:00" }],
    summary: { total: 1, matched: 1, errors: 0 },
  }));
  const runMutation = vi.fn(async () => ({ inserted: 1, updated: 0, errors: [] }));
  const ctx = { runAction, runMutation } as unknown as ActionCtx;
  await expect(importHandler(ctx, { csvText: "csv", note: " ab " })).rejects.toThrow("Gerekçe 3–500 karakter olmalı");
  expect(runAction).not.toHaveBeenCalled();
  expect(await importHandler(ctx, { csvText: "csv", note: "  Kart unutuldu  " })).toEqual({ inserted: 1, updated: 0, errors: 0 });
  expect(runMutation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ note: "Kart unutuldu" }));
});
