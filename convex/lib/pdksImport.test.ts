import { describe, expect, it, vi } from "vitest";
import { previewPdksCsv, importPdksCsv } from "../actions/pdksImport";
import { listLightForImport } from "../employees";
import type { QueryCtx } from "../_generated/server";
import * as scope from "./projectScope";
vi.mock("../_generated/server", async (importOriginal) => ({ ...await importOriginal<typeof import("../_generated/server")>(), action: (config: unknown) => config }));
vi.mock("./customFunctions", async (importOriginal) => ({ ...await importOriginal<typeof import("./customFunctions")>(), authedQuery: (config: unknown) => config }));
const csvText = "tcNo,tarih,giriş,çıkış,not\n123,2026-10-19,09:00,18:00,not\n123,2026-10-19,18:00,09:00,not";
const call = <T>(fn: unknown, ctx: unknown, args: unknown) => (fn as { handler: (ctx: unknown, args: unknown) => Promise<T> }).handler(ctx, args);
describe("08-O4/D9 CSV kapsamı", () => {
  it("önizleme aktif projeyi eşleştirmeye geçirir, Türkçe başlıkları kabul eder, ters saati reddeder", async () => {
    const runQuery = vi.fn().mockResolvedValueOnce([{ _id: "employee", tcNo: "123", firstName: "Ada", lastName: "Test" }]).mockResolvedValueOnce([]);
    const result = await call<{ rows: { employeeId?: string; error?: string; entryTime?: string; exitTime?: string }[]; summary: { errors: number } }>(previewPdksCsv, { runQuery }, { csvText, projectId: "active" });
    expect(runQuery.mock.calls[0]?.[1]).toEqual({ projectId: "active" });
    expect(result.rows[0]).toMatchObject({ employeeId: "employee", entryTime: "09:00", exitTime: "18:00" });
    expect(result.rows[1]?.error).toBe("Çıkış saati girişten sonra olmalı. Gece vardiyası atanmamış.");
    expect(result.summary.errors).toBe(1);
  });
  it("hatalı eşleşmeleri yazmaya göndermez ve aktif projeyi tekrar önizletir", async () => {
    const runAction = vi.fn(async (_reference: unknown, _args: unknown) => ({ rows: [{ employeeId: "bad", error: "Saat hatası" }, { employeeId: "good", date: "2026-10-19", entryTime: "09:00" }], summary: { errors: 1 } }));
    const runMutation = vi.fn(async (_reference: unknown, _args: unknown) => ({ inserted: 1, updated: 0, errors: [] }));
    const result = await call(importPdksCsv, { runAction, runMutation }, { csvText, note: "Geçerli gerekçe", projectId: "active" });
    expect(runAction.mock.calls[0]?.[1]).toMatchObject({ projectId: "active" });
    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({ rows: [{ employeeId: "good", date: "2026-10-19", entryTime: "09:00" }] });
    expect(result).toEqual({ inserted: 1, updated: 0, errors: 1 });
  });
  it("eşleştirme sorgusu izin kontrolünden sonra yalnız aktif proje indexini okur", async () => {
    const authorize = vi.spyOn(scope, "resolveProjectScope").mockResolvedValue([]);
    const eq = vi.fn();
    const chain = { withIndex: (_name: string, callback: (q: { eq: typeof eq }) => unknown) => { callback({ eq }); return chain; }, collect: async () => [] };
    const ctx = { user: { _id: "admin", role: "super_admin" }, db: { query: () => chain } } as unknown as QueryCtx;
    expect(await call(listLightForImport, ctx, { projectId: "active" })).toEqual([]);
    expect(authorize).toHaveBeenCalledWith(ctx, "active");
    expect(eq).toHaveBeenCalledWith("projectId", "active");
    authorize.mockRestore();
  });
});

it("R3B-D7: CSV accepts a reversed pair only for that employee's assigned night date", async () => {
  const runQuery = vi.fn().mockResolvedValueOnce([{ _id: "employee", tcNo: "123", firstName: "Ada", lastName: "Test" }])
    .mockResolvedValueOnce([{ key: "employee__2026-10-19", startTime: "22:00", endTime: "06:00" }]);
  const text = "tcNo,tarih,giriş,çıkış\n123,2026-10-19,22:00,06:00\n123,2026-10-20,22:00,06:00";
  const result = await call<{ rows: { employeeId?: string; error?: string }[]; summary: { errors: number } }>(previewPdksCsv, { runQuery }, { csvText: text, projectId: "active" });
  expect(runQuery.mock.calls[1]?.[1]).toEqual({ projectId: "active", rows: [{ employeeId: "employee", date: "2026-10-19" }, { employeeId: "employee", date: "2026-10-20" }] });
  expect(result.rows[0]).toMatchObject({ employeeId: "employee" });
  expect(result.rows[0]?.error).toBeUndefined();
  expect(result.rows[1]?.error).toContain("Gece vardiyası atanmamış");
  expect(result.summary.errors).toBe(1);
});

it("P-06: CSV accepts a reversed pair for a daytime shift whose exit window ends the next day", async () => {
  // previewManualShifts returns only shifts whose exit may cross midnight; a 09-18 shift qualifies via its window.
  const runQuery = vi.fn().mockResolvedValueOnce([{ _id: "employee", tcNo: "123", firstName: "Ada", lastName: "Test" }])
    .mockResolvedValueOnce([{ key: "employee__2026-10-19", startTime: "09:00", endTime: "18:00" }]);
  const text = "tcNo,tarih,giriş,çıkış\n123,2026-10-19,09:00,01:00\n123,2026-10-19,09:00,09:00";
  const result = await call<{ rows: { employeeId?: string; error?: string }[]; summary: { errors: number } }>(previewPdksCsv, { runQuery }, { csvText: text, projectId: "active" });
  expect(result.rows[0]?.error).toBeUndefined();
  expect(result.rows[1]?.error).toContain("Gece vardiyası atanmamış");
  expect(result.summary.errors).toBe(1);
});
