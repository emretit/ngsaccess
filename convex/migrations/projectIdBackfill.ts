import { v } from "convex/values";
import { query } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireSetupSecret, requireSuperAdmin } from "../lib/auth";
import { superAdminMutation } from "../lib/customFunctions";

const TABLES = [
  "employees",
  "employeeAuth",
  "devices",
  "accessRules",
  "groupMembers",
  "groupDevices",
  "cardReadings",
  "departments",
  "zones",
  "doors",
  "companies",
  "positions",
  "shifts",
  "shiftAssignments",
  "pdksRecords",
  "holidays",
  "leaves",
  "leaveBalances",
  "hikPendingOperations",
  "employeeFaces",
  "employeeFingerprints",
  "mailSettings",
  "generalSettings",
] as const;

type ManagedTable = (typeof TABLES)[number];

interface MaybeTenantDoc {
  _id: Id<ManagedTable>;
  projectId?: Id<"projects">;
}

async function countOrphansForTable(
  ctx: QueryCtx,
  table: ManagedTable,
): Promise<number> {
  const rows = (await ctx.db.query(table).collect()) as unknown as MaybeTenantDoc[];
  return rows.reduce((n, r) => (r.projectId ? n : n + 1), 0);
}

async function backfillTable(
  ctx: MutationCtx,
  table: ManagedTable,
  defaultProjectId: Id<"projects">,
): Promise<number> {
  const rows = (await ctx.db.query(table).collect()) as unknown as MaybeTenantDoc[];
  let updated = 0;
  for (const r of rows) {
    if (!r.projectId) {
      // Patch tip-laundering: TABLES içindeki tüm tablolarda projectId
      // optional v.id("projects") olarak schema'da tanımlı; runtime güvenli.
      await ctx.db.patch(r._id, { projectId: defaultProjectId } as never);
      updated++;
    }
  }
  return updated;
}

export const countOrphans = query({
  args: {},
  returns: v.array(
    v.object({ table: v.string(), nullCount: v.number() }),
  ),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const results: Array<{ table: string; nullCount: number }> = [];
    for (const table of TABLES) {
      results.push({ table, nullCount: await countOrphansForTable(ctx, table) });
    }
    return results;
  },
});

export const backfillToProject = superAdminMutation({
  args: {
    defaultProjectId: v.id("projects"),
    secret: v.string(),
  },
  returns: v.object({
    totalUpdated: v.number(),
    perTable: v.array(
      v.object({ table: v.string(), updated: v.number() }),
    ),
  }),
  handler: async (ctx, args) => {
    requireSetupSecret(args.secret);

    const project = await ctx.db.get(args.defaultProjectId);
    if (!project) {
      throw new Error("Hedef proje bulunamadı");
    }

    const perTable: Array<{ table: string; updated: number }> = [];
    let totalUpdated = 0;
    for (const table of TABLES) {
      const updated = await backfillTable(ctx, table, args.defaultProjectId);
      perTable.push({ table, updated });
      totalUpdated += updated;
    }
    return { totalUpdated, perTable };
  },
});
