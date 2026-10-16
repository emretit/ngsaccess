import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getProjectIdsForUser } from "./auth";

/** Seçili proje erişilebilir olmalı; seçim yoksa tüm izinli projeler kullanılır. */
export function selectProjectScope(
  allowed: ReadonlyArray<Id<"projects">>,
  projectId?: Id<"projects">,
): Id<"projects">[] {
  if (projectId !== undefined && !allowed.includes(projectId)) {
    throw new Error("Bu projeye erişim yetkiniz yok");
  }
  return projectId === undefined ? [...allowed] : [projectId];
}

export async function resolveProjectScope(
  ctx: QueryCtx | MutationCtx,
  projectId?: Id<"projects">,
): Promise<Id<"projects">[]> {
  return selectProjectScope(await getProjectIdsForUser(ctx), projectId);
}
