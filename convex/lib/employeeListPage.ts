import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { EMPLOYEE_LIST_VERSION, type EmployeeSortField } from "./employeeListShared";
import { filterAndSortEmployees } from "./employeeListShared";

const indexes = {
  name: { index: "by_project_nameAsc", field: "listKeys.nameAsc" },
  email: { index: "by_project_emailAsc", field: "listKeys.emailAsc" },
  company: { index: "by_project_companyAsc", field: "listKeys.companyAsc" },
  department: { index: "by_project_departmentAsc", field: "listKeys.departmentAsc" },
  position: { index: "by_project_positionAsc", field: "listKeys.positionAsc" },
  card: { index: "by_project_cardAsc", field: "listKeys.cardAsc" },
  status: { index: "by_project_statusAsc", field: "listKeys.statusAsc" },
} as const;
const scope = `${EMPLOYEE_LIST_VERSION}:E\u0000`;
const scopeEnd = `${EMPLOYEE_LIST_VERSION}:E\u0001`;
const MAX_READS = 2000;
const MAX_BYTES = 6 * 1024 * 1024;
type Filters = { search?: string; department?: string; status?: string; company?: string; position?: string; departmentIds: string[] };
type Organization = { _id: string; name: string };
type Cursor = { kind: string; key: string; id: string };
function decode(cursor: string | null, kind: string): Cursor {
  if (!cursor) return { kind, key: "", id: "" };
  const value: unknown = JSON.parse(cursor);
  if (!value || typeof value !== "object" || !("kind" in value) || value.kind !== kind || !("key" in value) || typeof value.key !== "string" || !("id" in value) || typeof value.id !== "string") throw new Error("InvalidCursor: Geçersiz kişi listesi imleci");
  return { kind, key: value.key, id: value.id };
}

export async function employeeListReady(ctx: QueryCtx, projectId: Id<"projects">) {
  const [first, last] = await Promise.all([
    ctx.db.query("employees").withIndex("by_project_nameAsc", q => q.eq("projectId", projectId)).first(),
    ctx.db.query("employees").withIndex("by_project_nameAsc", q => q.eq("projectId", projectId)).order("desc").first(),
  ]);
  return !first || (first.listVersion === EMPLOYEE_LIST_VERSION && last?.listVersion === EMPLOYEE_LIST_VERSION);
}

/** Legacy false and omitted visitor flags both represent employees; visits do not consume this cap. */
export async function employeeRowsForCounts(ctx: QueryCtx, projectId: Id<"projects">) {
  const implicit = await ctx.db.query("employees").withIndex("by_project_visitor", q => q.eq("projectId", projectId).eq("isVisitor", undefined)).take(2001);
  if (implicit.length >= 2001) return implicit;
  const explicit = await ctx.db.query("employees").withIndex("by_project_visitor", q => q.eq("projectId", projectId).eq("isVisitor", false)).take(2001 - implicit.length);
  return [...implicit, ...explicit];
}

/** Filter while reading: fill a visible page, with one shared row/byte budget and no device or mutation calls. */
export async function readIndexedEmployeePage(ctx: QueryCtx, projectId: Id<"projects">, fieldName: EmployeeSortField, direction: "asc" | "desc", cursor: string | null, size: number, filters: Filters, organizations?: Organization[]) {
  const { index, field } = indexes[fieldName];
  const page: Doc<"employees">[] = [];
  const matches = (employee: Doc<"employees">) => employee.isVisitor !== true && filterAndSortEmployees([employee], filters.search ?? "", filters.department ?? "", filters.status ?? "all", "name:asc", filters).length > 0;
  let reads = 0;
  let bytes = 0;
  let calls = 0;
  let isDone = false;
  const canRead = () => reads < MAX_READS && bytes < MAX_BYTES && calls < MAX_READS;
  const account = (rows: readonly Doc<"employees">[]) => { reads += rows.length; bytes += rows.reduce((sum, row) => sum + JSON.stringify(row).length * 2, 0); calls++; };

  if (organizations) {
    const state = decode(cursor, "org");
    const rows = [{ _id: "", name: "" }, ...organizations].sort((a, b) => (direction === "desc" ? -1 : 1) * a.name.localeCompare(b.name, "tr", { numeric: true }));
    const buckets: { name: string; ids: string[] }[] = [];
    for (const row of rows) {
      const previous = buckets[buckets.length - 1];
      if (previous && previous.name.localeCompare(row.name, "tr", { numeric: true }) === 0) previous.ids.push(row._id);
      else buckets.push({ name: row.name, ids: [row._id] });
    }
    let position = cursor ? buckets.findIndex(bucket => (direction === "desc" ? -1 : 1) * bucket.name.localeCompare(state.key, "tr", { numeric: true }) >= 0) : 0;
    if (position < 0) return { page, isDone: true, continueCursor: JSON.stringify(state) };
    while (position < buckets.length && page.length < size && canRead()) {
      const bucket = buckets[position];
      if (bucket.ids.length > MAX_READS - Math.max(reads, calls)) break;
      let after = cursor && bucket.name.localeCompare(state.key, "tr", { numeric: true }) === 0 ? state.id : "";
      const nextFor = async (orgId: string) => {
        const prefix = `${scope}${orgId}\u0000`;
        const row = await ctx.db.query("employees").withIndex(index, q => q.eq("projectId", projectId).gt(field, `${prefix}${after}`).lt(field, `${scope}${orgId}\u0001`)).first();
        account(row ? [row] : []);
        return row;
      };
      // Equal organization names merge by ascending employee ID, including in descending name order.
      const heads = new Map<string, Doc<"employees">>();
      for (const orgId of bucket.ids) {
        if (!canRead()) throw new Error("Aynı adlı organizasyonların sıralaması okuma sınırını aşıyor");
        const row = await nextFor(orgId);
        if (row) heads.set(orgId, row);
      }
      while (heads.size && page.length < size && canRead()) {
        const selected = [...heads].sort((a, b) => a[1]._id.localeCompare(b[1]._id))[0];
        if (!selected) break;
        const [orgId, row] = selected;
        after = row._id;
        state.key = bucket.name; state.id = after;
        if (matches(row)) page.push(row);
        heads.delete(orgId);
        if (page.length < size && canRead()) {
          const next = await nextFor(orgId);
          if (next) heads.set(orgId, next);
        }
      }
      if (page.length >= size || !canRead()) break;
      position++;
      if (position < buckets.length) { state.key = buckets[position].name; state.id = ""; }
    }
    isDone = position >= buckets.length;
    return { page, isDone, continueCursor: JSON.stringify(state) };
  }

  const state = decode(cursor, direction);
  let batchSize = Math.max(25, size);
  while (page.length < size && canRead()) {
    const limit = Math.min(direction === "asc" ? batchSize : 25, direction === "asc" ? MAX_READS : size - page.length, MAX_READS - reads);
    if (direction === "asc") {
      const rows = await ctx.db.query("employees").withIndex(index, q => {
        const range = q.eq("projectId", projectId);
        return (state.key ? range.gt(field, state.key) : range.gte(field, scope)).lt(field, scopeEnd);
      }).take(limit);
      account(rows);
      const previousCount = page.length;
      let processed = 0;
      for (const row of rows) {
        state.key = row.listKeys?.[`${fieldName}Asc`] ?? state.key;
        processed++;
        if (matches(row)) page.push(row);
        if (page.length >= size) break;
      }
      if (page.length === previousCount) batchSize = Math.min(100, batchSize * 2);
      if (rows.length < limit && processed === rows.length) { isDone = true; break; }
    } else {
      if (state.key) {
        const groupKey = state.key;
        const rows = await ctx.db.query("employees").withIndex(index, q => q.eq("projectId", projectId).gt(field, `${groupKey}\u0000${state.id}`).lt(field, `${groupKey}\u0001`)).take(limit);
        account(rows);
        for (const row of rows) { state.id = row._id; if (matches(row)) page.push(row); }
        if (page.length >= size || !canRead()) break;
        if (rows.length === limit) continue;
      }
      const next = await ctx.db.query("employees").withIndex(index, q => q.eq("projectId", projectId).gte(field, scope).lt(field, state.key ? `${state.key}\u0000` : scopeEnd)).order("desc").first();
      account(next ? [next] : []);
      if (!next?.listKeys) { isDone = true; break; }
      state.key = next.listKeys[`${fieldName}Asc`].slice(0, -(next._id.length + 1));
      state.id = "";
    }
  }
  return { page, isDone, continueCursor: JSON.stringify(state) };
}
