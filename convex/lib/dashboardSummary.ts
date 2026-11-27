import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { toPdksTransport, pdksReadingValidator } from "./pdksTransport";
import { trDateKey, trDayRangeISO, trCalendarDate } from "./trDate";
import { createHourlyCounter } from "./dashboardTimeline";

const PAGE_SIZE = 64;
const MAX_PAGES = 512;
export const DASHBOARD_SHARDS = 8;
export function dashboardShard(deviceId: string | undefined, readingId: string): number {
  let hash = 0;
  for (const char of deviceId ?? readingId) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return hash % DASHBOARD_SHARDS;
}
type Evidence = typeof pdksReadingValidator.type;
// Dictionary coding removes repeated field names, tenant/card/device IDs and timestamps.
// Each page is capped at 64 events, independently of the project/day traffic.
export function encodeEvidence(rows: readonly Evidence[]): ArrayBuffer {
  const strings: string[] = [];
  const indices = new Map<string, number>();
  const intern = (value: string | undefined) => {
    if (value === undefined) return 0;
    const known = indices.get(value);
    if (known !== undefined) return known;
    strings.push(value); const index = strings.length; indices.set(value, index); return index;
  };
  const numbers: number[] = [];
  const numberIndices = new Map<number, number>();
  const number = (value: number | undefined) => {
    if (value === undefined) return 0;
    const known = numberIndices.get(value); if (known !== undefined) return known;
    numbers.push(value); numberIndices.set(value, numbers.length); return numbers.length;
  };
  const tuples = rows.map(r => [intern(r._id), intern(r.employeeId), intern(r.deviceId), intern(r.cardNo), intern(r.accessTime), intern(r.accessStatus), intern(r.direction), intern(r.pdksSource), number(r._creationTime), number(r.ideIoId), number(r.hikCardReaderNo)]);
  // Noncanonical varint prefix cannot occur in the original codec. Keep old pages
  // decodable for privacy/retention while new pages share constant tuple columns.
  const bytes: number[] = [255, 0];
  const uint = (value: number) => {
    do { const byte = value % 128; value = Math.floor(value / 128); bytes.push(byte + (value ? 128 : 0)); } while (value);
  };
  const float = (value: number) => { const buffer = new ArrayBuffer(8); new DataView(buffer).setFloat64(0, value); bytes.push(...new Uint8Array(buffer)); };
  uint(strings.length);
  for (const text of strings) { const encoded = new TextEncoder().encode(text); uint(encoded.length); for (const byte of encoded) bytes.push(byte); }
  uint(numbers.length); for (const value of numbers) float(value);
  uint(rows.length);
  let commonColumns = 0;
  for (let column = 0; column < 11; column++) if (tuples.length && tuples.every(tuple => tuple[column] === tuples[0][column])) commonColumns |= 1 << column;
  uint(commonColumns);
  for (let column = 0; column < 11; column++) {
    if (commonColumns & (1 << column)) uint(tuples[0][column]);
    else for (const tuple of tuples) uint(tuple[column]);
  }
  return new Uint8Array(bytes).buffer;
}
export function decodeEvidence(payload: ArrayBuffer, projectId?: Id<"projects">): Evidence[] {
  const bytes = new Uint8Array(payload), view = new DataView(payload);
  const columnCodec = bytes[0] === 255 && bytes[1] === 0;
  let offset = columnCodec ? 2 : 0;
  const uint = () => {
    let value = 0, scale = 1, byte: number;
    do { if (offset >= bytes.length || scale > 2 ** 49) throw new Error("Invalid dashboard evidence"); byte = bytes[offset++]; value += (byte % 128) * scale; scale *= 128; } while (byte >= 128);
    return value;
  };
  const float = () => { const value = view.getFloat64(offset); offset += 8; return value; };
  const strings: string[] = [];
  const stringCount = uint();
  for (let i = 0; i < stringCount; i++) { const length = uint(); strings.push(new TextDecoder().decode(bytes.subarray(offset, offset + length))); offset += length; }
  const numbers = Array.from({ length: uint() }, float);
  const rowCount = uint();
  const tuples = Array.from({ length: rowCount }, () => Array<number>(11).fill(0));
  if (columnCodec) {
    const commonColumns = uint();
    for (let column = 0; column < 11; column++) {
      if (commonColumns & (1 << column)) { const value = uint(); for (const tuple of tuples) tuple[column] = value; }
      else for (const tuple of tuples) tuple[column] = uint();
    }
  } else for (const tuple of tuples) for (let column = 0; column < 11; column++) tuple[column] = uint();
  const rows: Evidence[] = [];
  for (const tuple of tuples) {
    const text = (column: number) => tuple[column] ? strings[tuple[column] - 1] : undefined;
    const number = (column: number) => tuple[column] ? numbers[tuple[column] - 1] : undefined;
    const [_id, employeeId, deviceId, cardNo, accessTime, accessStatus, direction, pdksSource] = Array.from({ length: 8 }, (_, column) => text(column));
    // Private storage codec only writes the validated cardReadings transport shape.
    rows.push({ _id, _creationTime: number(8), projectId, employeeId, deviceId, cardNo, accessTime, accessStatus, direction, pdksSource, ideIoId: number(9), hikCardReaderNo: number(10) } as Evidence);
  }
  return rows;
}

export async function readDashboardEvidence(ctx: QueryCtx, projectId: Id<"projects">, date: string): Promise<Doc<"cardReadings">[] | null> {
  const day = await ctx.db.query("dashboardDays").withIndex("by_projectId_and_date", q => q.eq("projectId", projectId).eq("date", date)).unique();
  if (!day?.complete || day.formatVersion !== 2) return null;
  const pages = await ctx.db.query("dashboardEvidence").withIndex("by_projectId_and_date_and_hour_and_part", q => q.eq("projectId", projectId).eq("date", date)).take(MAX_PAGES + 1);
  if (pages.length > MAX_PAGES) return null;
  return pages.flatMap(page => decodeEvidence(page.payload, projectId)).sort((a, b) => a.accessTime.localeCompare(b.accessTime) || a._creationTime - b._creationTime || a._id.localeCompare(b._id));
}

export async function readDashboardTimeline(ctx: QueryCtx, projectId: Id<"projects">, date: string) {
  const day = await ctx.db.query("dashboardDays").withIndex("by_projectId_and_date", q => q.eq("projectId", projectId).eq("date", date)).unique();
  if (!day?.complete || day.formatVersion !== 2) return null;
  const result = createHourlyCounter().result();
  const hours = await ctx.db.query("dashboardHours").withIndex("by_projectId_and_date_and_hour", q => q.eq("projectId", projectId).eq("date", date)).take(25 * DASHBOARD_SHARDS);
  for (const row of hours) {
    result.hours[row.hour].granted += row.granted; result.hours[row.hour].denied += row.denied;
    result.total += row.total; result.granted += row.granted; result.denied += row.denied;
  }
  return result;
}

async function changeReading(ctx: MutationCtx, reading: Doc<"cardReadings">, delta: 1 | -1) {
  const { projectId } = reading;
  const date = trDateKey(reading.accessTime);
  const hour = trCalendarDate(reading.accessTime).getUTCHours();
  if (!Number.isInteger(hour)) return;
  const shard = dashboardShard(reading.deviceId, reading._id);
  const evidenceQuery = (bucket: number | undefined) => ctx.db.query("dashboardEvidence").withIndex("by_projectId_and_date_and_hour_and_shard_and_part", q => q.eq("projectId", projectId).eq("date", date).eq("hour", hour).eq("shard", bucket));
  const removeEvidence = async () => {
    for (const bucket of [shard, undefined]) for await (const page of evidenceQuery(bucket)) {
      const rows = decodeEvidence(page.payload, projectId);
      const remaining = rows.filter(row => row._id !== reading._id);
      if (remaining.length !== rows.length) {
        if (remaining.length) await ctx.db.patch(page._id, { count: remaining.length, payload: encodeEvidence(remaining) });
        else await ctx.db.delete(page._id);
        return true;
      }
    }
    return false;
  };
  let day = await ctx.db.query("dashboardDays").withIndex("by_projectId_and_date", q => q.eq("projectId", projectId).eq("date", date)).unique();
  if (!day && delta === -1) { await removeEvidence(); return; }
  if (!day) {
    const { startISO, endISO } = trDayRangeISO(date, date);
    const prior = await ctx.db.query("cardReadings").withIndex("by_project_access_time", q => q.eq("projectId", projectId).gte("accessTime", startISO).lte("accessTime", endISO)).take(2);
    const complete = delta === 1 && prior.every(row => row._id === reading._id);
    const id = await ctx.db.insert("dashboardDays", { projectId, date, complete, formatVersion: 2 });
    if (projectId) await initializeDashboardCounts(ctx, projectId);
    day = { _id: id, _creationTime: Date.now(), projectId, date, complete, formatVersion: 2 };
  }
  if (day.formatVersion !== 2) { await ctx.db.patch(day._id, { complete: false, formatVersion: 2 }); day = { ...day, complete: false, formatVersion: 2 }; }
  // Pre-release days deliberately retain the original path; never publish a partial total.
  if (!day.complete) { if (delta === -1) await removeEvidence(); return; }
  const counter = await ctx.db.query("dashboardHours").withIndex("by_projectId_and_date_and_hour_and_shard", q => q.eq("projectId", projectId).eq("date", date).eq("hour", hour).eq("shard", shard)).unique();
  const counts = { total: (counter?.total ?? 0) + delta, granted: (counter?.granted ?? 0) + (reading.accessStatus === "izin_verildi" ? delta : 0), denied: (counter?.denied ?? 0) + (reading.accessStatus === "reddedildi" ? delta : 0) };
  if (counter) await ctx.db.patch(counter._id, counts);
  else await ctx.db.insert("dashboardHours", { projectId, date, hour, shard, ...counts });
  const query = evidenceQuery(shard);
  if (delta === 1) {
    const last = await query.order("desc").first();
    if (last && last.count < PAGE_SIZE) {
      const rows = [...decodeEvidence(last.payload, projectId), toPdksTransport(reading)];
      const payload = encodeEvidence(rows);
      if (payload.byteLength <= 48_000) await ctx.db.patch(last._id, { count: rows.length, payload });
      else await ctx.db.insert("dashboardEvidence", { projectId, date, hour, shard, part: last.part + 1, count: 1, payload: encodeEvidence([toPdksTransport(reading)]) });
    } else await ctx.db.insert("dashboardEvidence", { projectId, date, hour, shard, part: (last?.part ?? -1) + 1, count: 1, payload: encodeEvidence([toPdksTransport(reading)]) });
  } else {
    if (await removeEvidence()) return;
    // A writer predating this release was edited: fail closed to original evidence.
    await ctx.db.patch(day._id, { complete: false });
  }
}

type CountKind = Doc<"dashboardCounts">["kind"];
type CountDoc = Doc<"employees"> | Doc<"devices"> | Doc<"accessRules">;
function contribution(kind: CountKind, doc: CountDoc | null) {
  if (!doc) return 0;
  if (kind === "employees") return 1;
  return "isActive" in doc && doc.isActive === (kind === "devices") ? 1 : 0;
}
/** Bounded lazy initialization; large projects keep the original exact count path. */
export async function initializeDashboardCounts(ctx: MutationCtx, projectId?: Id<"projects">) {
  for (const kind of ["employees", "devices", "accessRules"] as const) {
    const existing = await ctx.db.query("dashboardCounts").withIndex("by_projectId_and_kind", q => q.eq("projectId", projectId).eq("kind", kind)).unique();
    if (existing) continue;
    const rows = await ctx.db.query(kind).withIndex("by_project", q => q.eq("projectId", projectId)).take(1001);
    await ctx.db.insert("dashboardCounts", { projectId, kind, count: rows.length > 1000 ? -1 : rows.reduce((sum, doc) => sum + contribution(kind, doc), 0) });
  }
}
async function changeCount(ctx: MutationCtx, kind: CountKind, before: CountDoc | null, after: CountDoc | null) {
  for (const projectId of new Set([before?.projectId, after?.projectId])) {
    const delta = (after?.projectId === projectId ? contribution(kind, after) : 0) - (before?.projectId === projectId ? contribution(kind, before) : 0);
    if (!delta) continue;
    const counter = await ctx.db.query("dashboardCounts").withIndex("by_projectId_and_kind", q => q.eq("projectId", projectId).eq("kind", kind)).unique();
    if (counter && counter.count < 0) continue;
    if (counter) await ctx.db.patch(counter._id, { count: counter.count + delta });
    else await initializeDashboardCounts(ctx, projectId);
  }
}
async function syncReadingFeed(ctx: MutationCtx, before: Doc<"cardReadings"> | null, after: Doc<"cardReadings"> | null) {
  const readingId = after?._id ?? before?._id;
  if (!readingId) return;
  const existing = await ctx.db.query("dashboardReadingFeed").withIndex("by_readingId", q => q.eq("readingId", readingId)).unique();
  if (!after) { if (existing) await ctx.db.delete(existing._id); return; }
  const { projectId, accessTime, cardNo, employeeName, deviceId, accessStatus, direction } = after;
  const value = { readingId, readingCreationTime: after._creationTime, projectId, accessTime, cardNo, employeeName, deviceId, accessStatus, direction };
  if (existing) await ctx.db.patch(existing._id, value);
  else await ctx.db.insert("dashboardReadingFeed", value);
}
export const dashboardTriggers = new Triggers<DataModel>();
dashboardTriggers.register("cardReadings", async (ctx, change) => {
  const plain = { ...ctx, db: ctx.innerDb };
  await syncReadingFeed(plain, change.oldDoc, change.newDoc);
  if (change.oldDoc && change.newDoc && JSON.stringify(toPdksTransport(change.oldDoc)) === JSON.stringify(toPdksTransport(change.newDoc))) return;
  if (change.oldDoc) await changeReading(plain, change.oldDoc, -1);
  if (change.newDoc) await changeReading(plain, change.newDoc, 1);
});
for (const kind of ["employees", "devices", "accessRules"] as const) dashboardTriggers.register(kind, async (ctx, change) => changeCount({ ...ctx, db: ctx.innerDb }, kind, change.oldDoc, change.newDoc));
const hookMarker = Symbol.for("ngs.dashboardSummary.writer");
/** Idempotent hook for helpers that can be called outside registered mutations (tests/seeds). */
export function withDashboardSummary<T extends MutationCtx>(ctx: T): T {
  if (Reflect.get(ctx.db, hookMarker) === true) return ctx;
  const result = dashboardTriggers.wrapDB(ctx);
  Object.defineProperty(result.db, hookMarker, { value: true });
  return result;
}
