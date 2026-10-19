import { isOvernightShift, type PdksShift } from "./pdksWorkDay";
import { ConvexError } from "convex/values";

export function validateManualPdksNote(value?: string) {
  const note = value?.trim() ?? "";
  if (note.length < 3 || note.length > 500) throw new ConvexError("Gerekçe 3–500 karakter olmalı");
  return note;
}

export function isManualPdksTimeOrderValid(entryTime: string | undefined, exitTime: string | undefined, shift?: PdksShift | null): boolean {
  return !entryTime || !exitTime || entryTime < exitTime || isOvernightShift(shift);
}

/** Shared, side-effect-free validation; note stays optional at transport level for old callers. */
export function validateManualPdksInput(input: { date: string; entryTime?: string; exitTime?: string; note?: string }, shift?: PdksShift | null) {
  const note = validateManualPdksNote(input.note);
  const entryTime = input.entryTime?.trim() || undefined;
  const exitTime = input.exitTime?.trim() || undefined;
  if (!entryTime && !exitTime) throw new ConvexError("En az bir saat girin");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ConvexError("Geçersiz tarih formatı (YYYY-MM-DD)");
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (entryTime && !hhmm.test(entryTime)) throw new ConvexError("Geçersiz giriş saati (HH:MM)");
  if (exitTime && !hhmm.test(exitTime)) throw new ConvexError("Geçersiz çıkış saati (HH:MM)");
  if (!isManualPdksTimeOrderValid(entryTime, exitTime, shift)) throw new ConvexError("Çıkış saati giriş saatinden sonra olmalı");
  return { note, entryTime, exitTime };
}
