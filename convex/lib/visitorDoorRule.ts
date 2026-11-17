import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { insertAccessRuleWithGroups } from "./accessRuleWrite";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MAX_VISITOR_DOORS = 200;
const MAX_VISITOR_RULES = 500;

const sameSet = (a: readonly string[], b: ReadonlySet<string>) =>
  a.length === b.size && a.every(id => b.has(id));

/** Ziyaretçi kuralı her gün, tüm gün ve iki yönde açıksa kapı seçimiyle eşleşebilir. */
function isAlwaysOpenVisitorRule(rule: Doc<"accessRules">) {
  return rule.targetType === "visitor" && rule.isActive !== false && !rule.startTime && !rule.endTime &&
    (rule.accessDirection ?? "both") === "both" && ALL_DAYS.every(day => rule.days?.includes(day));
}

export function visitorDoorRuleName(doorNames: readonly string[]) {
  const names = [...doorNames].sort((a, b) => a.localeCompare(b, "tr"));
  const shown = names.slice(0, 3).join(", ");
  return `Ziyaretçi · ${shown}${names.length > 3 ? ` +${names.length - 3}` : ""}`;
}

/**
 * Ziyaretçi formundaki kapı seçimini bir ziyaretçi kuralına çevirir. Aynı kapı setine sahip
 * her zaman açık kural varsa yeniden kullanılır; yoksa otomatik adla oluşturulur. Her kural
 * Hik cihazında bir hafta planı numarası harcadığından ziyaretçi başına kural açılmaz.
 * Yetkiyi (visitors.manage) çağıran doğrular.
 */
export async function resolveVisitorDoorRule(
  ctx: MutationCtx,
  projectId: Id<"projects"> | undefined,
  doorIds: readonly Id<"doors">[],
): Promise<Id<"accessRules">> {
  if (!projectId) throw new Error("Önce bir proje seçin");
  const uniqueDoorIds = [...new Set(doorIds)];
  if (!uniqueDoorIds.length) throw new Error("Ziyaretçinin geçeceği en az bir kapı seçin");
  if (uniqueDoorIds.length > MAX_VISITOR_DOORS) throw new Error(`En fazla ${MAX_VISITOR_DOORS} kapı seçilebilir`);
  const doors: Doc<"doors">[] = [];
  for (const doorId of uniqueDoorIds) {
    const door = await ctx.db.get(doorId);
    if (!door || door.projectId !== projectId) throw new Error("Seçilen kapı bu projede bulunamadı");
    if (!door.deviceId) throw new Error(`${door.name} kapısı bir cihaza bağlı değil`);
    doors.push(door);
  }
  const deviceIds = [...new Set(doors.map(door => door.deviceId).filter((id): id is Id<"devices"> => id !== undefined))];
  const wantedDoors = new Set<string>(uniqueDoorIds);
  const wantedDevices = new Set<string>(deviceIds);

  const rules = await ctx.db.query("accessRules")
    .withIndex("by_project_targetType", q => q.eq("projectId", projectId).eq("targetType", "visitor"))
    .take(MAX_VISITOR_RULES);
  for (const rule of rules) {
    if (!isAlwaysOpenVisitorRule(rule)) continue;
    const [ruleDoors, ruleDevices] = await Promise.all([
      ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", rule._id)).take(MAX_VISITOR_DOORS + 1),
      ctx.db.query("groupDevices").withIndex("by_group", q => q.eq("groupId", rule._id)).take(MAX_VISITOR_DOORS + 1),
    ]);
    if (sameSet(ruleDoors.map(link => link.doorId), wantedDoors) &&
        sameSet(ruleDevices.map(link => link.deviceId), wantedDevices)) return rule._id;
  }

  return insertAccessRuleWithGroups(ctx, {
    name: visitorDoorRuleName(doors.map(door => door.name)),
    projectId,
    targetType: "visitor",
    description: "Ziyaretçi kapı seçiminden otomatik oluşturuldu",
    days: ALL_DAYS,
    accessDirection: "both",
    deviceIds,
    doorIds: uniqueDoorIds,
  });
}
