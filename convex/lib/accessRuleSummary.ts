import type { Doc } from "../_generated/dataModel";

export function panelScope(
  device: Pick<
    Doc<"devices">,
    "_id" | "name" | "doorCount" | "ideDoorCount" | "hikDoorCount" | "brand"
  >,
  doors: ReadonlyArray<Pick<Doc<"doors">, "_id" | "name">>,
  selectedDoorIds: ReadonlySet<string>,
  hasDeviceMembership: boolean,
) {
  const selected = doors.filter((door) => selectedDoorIds.has(door._id));
  const totalDoors = Math.max(
    doors.length,
    device.doorCount ??
      device.ideDoorCount ??
      device.hikDoorCount ??
      (device.brand === "ide_smart" ? 4 : 1),
  );
  const wholePanel =
    (selected.length === 0 && hasDeviceMembership) ||
    selected.length === totalDoors;
  const coveredDoors = wholePanel ? doors : selected;
  return {
    deviceId: device._id,
    name: device.name,
    totalDoors,
    selectedDoors: wholePanel ? totalDoors : selected.length,
    wholePanel,
    label: `${device.name} — ${wholePanel ? "tüm kapılar" : `${selected.length}/${totalDoors} kapı`}`,
    doors: coveredDoors.map((door) => ({ doorId: door._id, name: door.name })),
  };
}

export function matchesRuleStatus(
  isActive: boolean | undefined,
  status: "all" | "active" | "inactive",
) {
  return status === "all" || (isActive ?? true) === (status === "active");
}

export function pageRuleCandidates<
  T extends { _id: string; _creationTime: number },
>(rules: readonly T[], cursor: string | null, numItems: number, scope: string) {
  let after: { id: string; time: number } | null = null;
  if (cursor) {
    const value: unknown = JSON.parse(cursor);
    if (
      !value ||
      typeof value !== "object" ||
      !("scope" in value) ||
      value.scope !== scope ||
      !("id" in value) ||
      typeof value.id !== "string" ||
      !("time" in value) ||
      typeof value.time !== "number"
    ) {
      throw new Error("Arama değişti; ilk sayfadan yeniden deneyin");
    }
    after = { id: value.id, time: value.time };
  }
  const sorted = [...rules].sort(
    (a, b) => b._creationTime - a._creationTime || b._id.localeCompare(a._id),
  );
  const remaining = sorted.filter(
    (rule) =>
      !after ||
      rule._creationTime < after.time ||
      (rule._creationTime === after.time &&
        rule._id.localeCompare(after.id) < 0),
  );
  const page = remaining.slice(0, numItems);
  const last = page[page.length - 1];
  return {
    page,
    isDone: remaining.length <= numItems,
    continueCursor: last
      ? JSON.stringify({ scope, id: last._id, time: last._creationTime })
      : (cursor ?? ""),
  };
}

export function personSearchTerms(search: string) {
  const words = search
    .trim()
    .toLocaleLowerCase("tr")
    .split(/\s+/)
    .filter(Boolean);
  const lookup = [...words].sort((a, b) => b.length - a.length)[0] ?? "";
  return { words, lookup };
}

export function activeRuleCursor(
  cursor: string | null,
  scope: string,
): { phase: "active" | "legacy"; cursor: string | null } {
  if (!cursor) return { phase: "active", cursor: null };
  const value: unknown = JSON.parse(cursor);
  if (
    !value ||
    typeof value !== "object" ||
    !("scope" in value) ||
    value.scope !== scope ||
    !("phase" in value) ||
    (value.phase !== "active" && value.phase !== "legacy") ||
    !("cursor" in value) ||
    (value.cursor !== null && typeof value.cursor !== "string")
  ) {
    throw new Error("Arama değişti; ilk sayfadan yeniden deneyin");
  }
  return { phase: value.phase, cursor: value.cursor };
}

export type RuleTypeFilter = "all" | "visitor" | "personnel";
export function matchesRuleType(targetType: string | undefined, type: RuleTypeFilter) {
  return type === "all" || (type === "visitor" ? targetType === "visitor" : targetType !== "visitor");
}

/** Legacy personnel kinds remain queryable without rewriting stored rules. */
export function ruleTypeStages(
  type: Exclude<RuleTypeFilter, "all">,
  status: "all" | "active" | "inactive",
  personnelTypes: (string | undefined)[] = [],
) {
  const types = type === "visitor" ? ["visitor"] : personnelTypes.filter(value => value !== "visitor");
  const activeStates: readonly (boolean | "all" | undefined)[] =
    status === "active" ? [true, undefined] : status === "inactive" ? [false] : ["all"];
  return types.flatMap(targetType => activeStates.map(isActive => ({ targetType, isActive })));
}

/** At most one native paginate per query; empty index partitions are skipped with first(). */
export async function pageRuleStages<T>(
  stages: number,
  scope: string,
  cursor: string | null,
  fetch: (stage: number, cursor: string | null) => Promise<{ page: T[]; isDone: boolean; continueCursor: string }>,
  exists: (stage: number) => Promise<boolean>,
) {
  let phase = 0;
  let nativeCursor: string | null = null;
  if (cursor) {
    const value: unknown = JSON.parse(cursor);
    if (!value || typeof value !== "object" || !("scope" in value) || value.scope !== scope || !("phase" in value) || typeof value.phase !== "number" || !Number.isInteger(value.phase) || value.phase < 0 || value.phase >= stages || !("cursor" in value) || (value.cursor !== null && typeof value.cursor !== "string")) throw new Error("Arama değişti; ilk sayfadan yeniden deneyin");
    phase = value.phase;
    nativeCursor = value.cursor;
  }
  while (nativeCursor === null && phase < stages && !(await exists(phase))) phase += 1;
  if (phase === stages) return { page: [] as T[], isDone: true, continueCursor: "" };
  const result = await fetch(phase, nativeCursor);
  if (!result.isDone) return { ...result, continueCursor: JSON.stringify({ scope, phase, cursor: result.continueCursor }) };
  do { phase += 1; } while (phase < stages && !(await exists(phase)));
  return { ...result, isDone: phase === stages, continueCursor: phase === stages ? "" : JSON.stringify({ scope, phase, cursor: null }) };
}

/** Seek one row per distinct type, including unknown legacy personnel kinds. */
export async function personnelRuleTypes(next: (after: { value: string | undefined } | null) => Promise<{ targetType?: string } | null>) {
  const types: (string | undefined)[] = [];
  let after: { value: string | undefined } | null = null;
  for (;;) {
    const row = await next(after);
    if (!row) return types;
    if (types.length >= 100) throw new Error("Çok fazla kural türü var; liste yüklenemedi");
    if (row.targetType !== "visitor") types.push(row.targetType);
    after = { value: row.targetType };
  }
}
