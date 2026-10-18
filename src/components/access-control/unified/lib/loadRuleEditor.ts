import type { FunctionReturnType } from "convex/server";
import type { ConvexReactClient } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type { AccessRule, GroupMember, GroupDevice, GroupDoor } from "@/types/access-control";

/** Freeze an editor snapshot only after all cursor pages succeed. Never use getDetails' preview as membership. */
export async function loadRuleEditor(
  client: Pick<ConvexReactClient, "query">,
  ruleId: Id<"accessRules">,
  projectId?: Id<"projects">,
): Promise<AccessRule> {
  const details = await client.query(api.accessRules.getDetails, { ruleId, projectId });
  const groupMembers: GroupMember[] = [];
  const groupDevices: GroupDevice[] = [];
  const groupDoors: GroupDoor[] = [];
  await Promise.all((["people", "devices", "doors"] as const).map(async kind => {
    let cursor: string | null = null;
    for (;;) {
      const result: FunctionReturnType<typeof api.accessRules.listRuleMembers> = await client.query(api.accessRules.listRuleMembers, {
        ruleId, kind, paginationOpts: { cursor, numItems: 50 },
      });
      if (result.kind === "people") groupMembers.push(...result.page);
      else if (result.kind === "devices") groupDevices.push(...result.page);
      else groupDoors.push(...result.page.map(row => ({ doorId: row.doorId, deviceId: row.doors?.deviceId })));
      if (result.isDone) break;
      if (result.continueCursor === cursor) throw new Error("Kural listesi yüklenemedi. Yeniden deneyin.");
      cursor = result.continueCursor;
    }
  }));
  return { ...details, groupMembers, groupDevices, groupDoors };
}
