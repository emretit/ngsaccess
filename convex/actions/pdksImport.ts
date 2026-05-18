"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface ParsedRow {
  index: number;
  raw: string;
  identifier: string;
  date: string;
  entryTime?: string;
  exitTime?: string;
  note?: string;
}

interface MatchedRow extends ParsedRow {
  employeeId?: string;
  matchedName?: string;
  error?: string;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function parseCsv(csv: string): ParsedRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headerCols = parseCsvLine(lines[0]).map((c) => c.toLowerCase());
  const idIdx = headerCols.findIndex((c) =>
    ["tc", "tcno", "tckimlik", "tc_no", "id", "employee", "personel"].some((k) => c.includes(k)),
  );
  const dateIdx = headerCols.findIndex((c) => c.includes("tarih") || c === "date");
  const entryIdx = headerCols.findIndex((c) => c.includes("giri") || c === "entry" || c === "entry_time");
  const exitIdx = headerCols.findIndex((c) => c.includes("çık") || c === "exit" || c === "exit_time");
  const noteIdx = headerCols.findIndex((c) => c.includes("not") || c === "note");

  if (idIdx < 0 || dateIdx < 0) {
    throw new Error(
      "CSV başlık satırı eksik: 'tc' (veya 'personel') ve 'tarih' kolonu gerekli",
    );
  }

  const out: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length === 0) continue;
    out.push({
      index: i,
      raw: lines[i],
      identifier: cols[idIdx] ?? "",
      date: cols[dateIdx] ?? "",
      entryTime: entryIdx >= 0 ? cols[entryIdx] || undefined : undefined,
      exitTime: exitIdx >= 0 ? cols[exitIdx] || undefined : undefined,
      note: noteIdx >= 0 ? cols[noteIdx] || undefined : undefined,
    });
  }
  return out;
}

export const previewPdksCsv = action({
  args: { csvText: v.string() },
  handler: async (ctx, args): Promise<{
    rows: MatchedRow[];
    summary: { total: number; matched: number; errors: number };
  }> => {
    const rows = parseCsv(args.csvText);
    if (rows.length === 0) return { rows: [], summary: { total: 0, matched: 0, errors: 0 } };
    if (rows.length > 500) {
      throw new Error("Tek seferde en fazla 500 satır içe aktarılabilir");
    }

    const lookups: { tcNo: string; firstName?: string; lastName?: string; _id: string }[] =
      await ctx.runQuery(api.employees.listLightForImport, {});
    const byTc = new Map<string, (typeof lookups)[number]>();
    for (const e of lookups) {
      if (e.tcNo) byTc.set(e.tcNo, e);
    }

    const matched: MatchedRow[] = rows.map((r) => {
      const result: MatchedRow = { ...r };
      const emp = byTc.get(r.identifier.trim());
      if (!emp) {
        result.error = `Çalışan bulunamadı: '${r.identifier}'`;
        return result;
      }
      if (!DATE_REGEX.test(r.date)) {
        result.error = "Geçersiz tarih (YYYY-MM-DD)";
        return result;
      }
      if (r.entryTime && !HHMM_REGEX.test(r.entryTime)) {
        result.error = "Geçersiz giriş saati";
        return result;
      }
      if (r.exitTime && !HHMM_REGEX.test(r.exitTime)) {
        result.error = "Geçersiz çıkış saati";
        return result;
      }
      result.employeeId = emp._id;
      result.matchedName = `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim();
      return result;
    });

    return {
      rows: matched,
      summary: {
        total: matched.length,
        matched: matched.filter((m) => m.employeeId).length,
        errors: matched.filter((m) => m.error).length,
      },
    };
  },
});

export const importPdksCsv = action({
  args: { csvText: v.string() },
  handler: async (ctx, args): Promise<{ inserted: number; updated: number; errors: number }> => {
    const preview: {
      rows: MatchedRow[];
      summary: { total: number; matched: number; errors: number };
    } = await ctx.runAction(api.actions.pdksImport.previewPdksCsv, {
      csvText: args.csvText,
    });
    const validRows = preview.rows.filter((r): r is MatchedRow & { employeeId: string } => Boolean(r.employeeId));
    if (validRows.length === 0) {
      return { inserted: 0, updated: 0, errors: preview.summary.errors };
    }
    const result: { inserted: number; updated: number; errors: { index: number; message: string }[] } =
      await ctx.runMutation(api.pdksRecords.bulkUpsertManual, {
        rows: validRows.map((r) => ({
          employeeId: r.employeeId as never,
          date: r.date,
          entryTime: r.entryTime,
          exitTime: r.exitTime,
          note: r.note,
        })),
      });
    return {
      inserted: result.inserted,
      updated: result.updated,
      errors: result.errors.length + preview.summary.errors,
    };
  },
});
