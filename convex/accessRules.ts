import { requirePermission } from "./lib/permissions";
import { listAccessRules, listAccessRuleMemberships } from "./lib/accessRuleRead";
import { createAccessRuleWithGroups } from "./lib/accessRuleWrite";
import { planRemovedEmployeeHik, reconcileRemovedEmployeeHik, snapshotRuleHikEmployees, resolveRuleDeviceTargets, hikSnapshotValidator, type HikSnapshot } from "./lib/peopleHikSnapshot";
import { resolveProjectScope } from "./lib/projectScope";
import { assertAccessProjectUnchanged } from "./lib/accessScope";
import { validateRuleAccessRelations } from "./lib/accessScopeRelations";
import { toPatch } from "./lib/nullablePatch";
import { assertAccessSchedule, assertAccessScheduleUpdate } from "./lib/accessRuleUx";

import { createRuleDiffRun } from "./deviceSyncRuns";

import { internal } from "./_generated/api";
import { ConvexError, v, type Infer } from "convex/values";
import { retainedDiffDoorIds, applyRelationDiff, assertLegacyRuleReplacement, ruleDiffSyncPlan, RULE_DETAILS_MEMBER_LIMIT, RULE_DETAILS_RELATION_LIMIT } from "./lib/accessRuleDiff";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed, canAccessEmployeeProject } from "./lib/auth";
import {
  resolveRuleIdeDeviceIds,
  reconcileRemovedEmployeeIde,
  reconcilePanelRosterIde,
} from "./lib/accessGraph";
import { diffIds, staleGroupDoorIds } from "./lib/reconcileMath";
import type { Doc, Id } from "./_generated/dataModel";
import { paginationOptsValidator, type PaginationOptions } from "convex/server";
import { matchesRuleStatus, matchesRuleType, personnelRuleTypes, ruleTypeStages, pageRuleStages, panelScope, pageRuleCandidates, personSearchTerms, activeRuleCursor } from "./lib/accessRuleSummary";
import { internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const HIK_RECONCILE_BATCH = 25;

async function ruleHikDevices(ctx: MutationCtx, rule: Doc<"accessRules">): Promise<HikSnapshot["devices"]> {
  return (await resolveRuleDeviceTargets(ctx, rule, false)).filter(({ device }) => device.brand === "hikvision").map(({ device }) => ({
    _id: device._id, name: device.name, brand: device.brand, projectId: device.projectId,
    hikDevIndex: device.hikDevIndex, hikTransport: device.hikTransport, hikDoorCount: device.hikDoorCount,
  }));
}

async function reconcileRuleSnapshots(ctx: MutationCtx, snapshots: Map<Id<"employees">, HikSnapshot>, idePanels?: Id<"devices">[]) {
  if (snapshots.size > HIK_RECONCILE_BATCH) {
    // Identities and old targets are frozen in the original transaction. No relationship
    // needs to survive deletion, and later edits are checked by each batch and action.
    const groups = new Map<string, { projectId: HikSnapshot["projectId"]; devices: HikSnapshot["devices"]; entries: { employeeId: Id<"employees">; cardNumber: string }[] }>();
    for (const [employeeId, snapshot] of snapshots) {
      const key = JSON.stringify([snapshot.projectId, snapshot.devices]);
      const group = groups.get(key) ?? { projectId: snapshot.projectId, devices: snapshot.devices, entries: [] };
      group.entries.push({ employeeId, cardNumber: snapshot.cardNumber });
      groups.set(key, group);
    }
    for (const group of groups.values()) await ctx.scheduler.runAfter(0, internal.accessRules.reconcileHikRemovalBatch, { ...group, idePanels });
    return;
  }
  for (const [employeeId, snapshot] of snapshots) {
    await reconcileRemovedEmployeeHik(ctx, employeeId, snapshot);
    if (idePanels) await reconcileRemovedEmployeeIde(ctx, { employeeId, projectId: snapshot.projectId, candidatePanels: idePanels });
  }
}

export const reconcileHikRemovalEntry = internalMutation({
  args: { employeeId: v.id("employees"), snapshot: hikSnapshotValidator, idePanels: v.optional(v.array(v.id("devices"))) },
  handler: async (ctx, args) => {
    await reconcileRemovedEmployeeHik(ctx, args.employeeId, args.snapshot);
    if (args.idePanels) await reconcileRemovedEmployeeIde(ctx, { employeeId: args.employeeId, projectId: args.snapshot.projectId, candidatePanels: args.idePanels });
  },
});

export const reconcileHikRemovalBatch = internalMutation({
  args: {
    projectId: hikSnapshotValidator.fields.projectId, devices: hikSnapshotValidator.fields.devices,
    entries: v.array(v.object({ employeeId: v.id("employees"), cardNumber: v.string() })),
    idePanels: v.optional(v.array(v.id("devices"))),
  },
  handler: async (ctx, args) => {
    if (args.entries.length > HIK_RECONCILE_BATCH) await ctx.scheduler.runAfter(0, internal.accessRules.reconcileHikRemovalBatch, { ...args, entries: args.entries.slice(HIK_RECONCILE_BATCH) });
    for (const entry of args.entries.slice(0, HIK_RECONCILE_BATCH)) {
      try {
        // Nested mutations isolate each entry's writes (including scheduled jobs).
        await ctx.runMutation(internal.accessRules.reconcileHikRemovalEntry, {
          employeeId: entry.employeeId, snapshot: { projectId: args.projectId, devices: args.devices, cardNumber: entry.cardNumber }, idePanels: args.idePanels,
        });
      } catch {
        for (const device of args.devices) await ctx.runMutation(internal.hikvisionSync.recordSyncFailure, {
          deviceId: device._id, projectId: args.projectId, operation: "deletePerson",
          payload: { employeeId: entry.employeeId, employeeNo: entry.cardNumber, cardNumber: entry.cardNumber },
          lastError: "Geri alma girdisi işlenemedi; cihazda kalmış olabilir",
        });
      }
    }
  },
});

/**
 * Kuraldan cihaz(lar) çıkarılırken o cihazlara ait (CANLI doors.deviceId) groupDoors
 * satırlarını siler. Reconcile kapı bağını artık "yetki" saydığından stale satır,
 * sökülen erişimi panelde yaşatırdı — temizlik bu yüzden zorunlu.
 */
async function deleteStaleGroupDoors(
  ctx: MutationCtx,
  ruleId: Id<"accessRules">,
  removedDeviceIds: ReadonlySet<Id<"devices">>,
): Promise<void> {
  const doorRows = await ctx.db
    .query("groupDoors")
    .withIndex("by_group", (q) => q.eq("groupId", ruleId))
    .collect();
  if (doorRows.length === 0) return;
  const doorDocs = await Promise.all(doorRows.map((row) => ctx.db.get(row.doorId)));
  const doorDeviceById = new Map<Id<"doors">, Id<"devices"> | undefined>();
  for (const door of doorDocs) {
    if (door !== null) doorDeviceById.set(door._id, door.deviceId);
  }
  const staleIds = staleGroupDoorIds(doorRows, doorDeviceById, removedDeviceIds);
  await Promise.all(staleIds.map((id) => ctx.db.delete(id)));
}

export const list = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    return await listAccessRules(ctx, args);
  },
});

export const listMemberships = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    return await listAccessRuleMemberships(ctx, args);
  },
});

// Özet maliyeti kart başına sınırlı; kişi belgeleri yalnız getDetails içinde okunur.
const SUMMARY_MEMBER_LIMIT = 100;
const SUMMARY_RELATION_LIMIT = 50;
const SUMMARY_PANEL_LIMIT = 20;
const SUMMARY_DOOR_LIMIT = 16;

async function readRuleScope(
  ctx: QueryCtx,
  rule: Doc<"accessRules">,
  detailed: boolean,
) {
  const deviceQuery = ctx.db
    .query("groupDevices")
    .withIndex("by_project_group", (q) =>
      q.eq("projectId", rule.projectId).eq("groupId", rule._id),
    );
  const doorQuery = ctx.db
    .query("groupDoors")
    .withIndex("by_group", (q) => q.eq("groupId", rule._id));
  const [deviceRows, doorRows] = await Promise.all([
    deviceQuery.take(RULE_DETAILS_RELATION_LIMIT + 1),
    doorQuery.take(RULE_DETAILS_RELATION_LIMIT + 1),
  ]);
  const scopeTruncated =
    deviceRows.length > SUMMARY_RELATION_LIMIT ||
    doorRows.length > SUMMARY_RELATION_LIMIT;
  // Kısmi kapı bağı okunduysa "tüm panel" çıkarımı güvenli değildir.
  if (scopeTruncated)
    return {
      panels: [],
      groupDevices: [],
      groupDoors: [],
      unassignedDoors: [],
      scopeTruncated,
      devicesTruncated: deviceRows.length > SUMMARY_RELATION_LIMIT,
      doorsTruncated: doorRows.length > SUMMARY_RELATION_LIMIT,
    };
  const selectedDoors = (
    await Promise.all(doorRows.map((row) => ctx.db.get(row.doorId)))
  )
    .filter((door): door is NonNullable<typeof door> => door !== null)
    .filter((door) => door.projectId === rule.projectId);
  const deviceIds = [
    ...new Set([
      ...deviceRows.map((row) => row.deviceId),
      ...selectedDoors.flatMap((door) =>
        door.deviceId ? [door.deviceId] : [],
      ),
    ]),
  ];
  if (!detailed && deviceIds.length > SUMMARY_PANEL_LIMIT) {
    return {
      panels: [],
      groupDevices: [],
      groupDoors: [],
      unassignedDoors: [],
      scopeTruncated: true,
      devicesTruncated: false,
      doorsTruncated: false,
    };
  }
  const devices = (await Promise.all(deviceIds.map((id) => ctx.db.get(id))))
    .filter((device): device is NonNullable<typeof device> => device !== null)
    .filter((device) => device.projectId === rule.projectId);
  const panels = await Promise.all(
    devices.map(async (device) => {
      const query = ctx.db
        .query("doors")
        .withIndex("by_device", (q) => q.eq("deviceId", device._id));
      const allDoors = await query.take(SUMMARY_DOOR_LIMIT + 1);
      const validDoors = allDoors.filter(
        (door) => door.projectId === rule.projectId,
      );
      const scope = panelScope(
        device,
        validDoors,
        new Set(selectedDoors.map((door) => door._id)),
        deviceRows.some((row) => row.deviceId === device._id),
      );
      const namedDoors = await Promise.all(
        (detailed ? scope.doors : scope.doors.slice(0, 3)).map(async (door) => {
          const document = validDoors.find((item) => item._id === door.doorId);
          const zone = document?.zoneId
            ? await ctx.db.get(document.zoneId)
            : null;
          return {
            ...door,
            zoneName:
              zone && zone.projectId === rule.projectId ? zone.name : null,
          };
        }),
      );
      return {
        ...scope,
        doors: detailed ? namedDoors : namedDoors.slice(0, 3),
        doorsTruncated: allDoors.length > SUMMARY_DOOR_LIMIT || (!detailed && scope.doors.length > 3),
        scopeTruncated: allDoors.length > SUMMARY_DOOR_LIMIT,
      };
    }),
  );
  return {
    panels,
    scopeTruncated: panels.some((panel) => panel.scopeTruncated),
    devicesTruncated: false,
    doorsTruncated: false,
    unassignedDoors: selectedDoors
      .filter((door) => !devices.some((device) => device._id === door.deviceId))
      .map((door) => ({ doorId: door._id, name: door.name })),
    groupDevices: deviceRows.map((row) => {
      const device = devices.find((item) => item._id === row.deviceId);
      return {
        ...row,
        devices: device
          ? {
              id: device._id,
              name: device.name,
              brand: device.brand,
              ideUuid: device.ideUuid,
              deviceSerial: device.deviceSerial,
              zoneId: device.zoneId,
              doorId: device.doorId,
            }
          : null,
      };
    }),
    groupDoors: selectedDoors.map((door) => ({
      doorId: door._id,
      deviceId: door.deviceId,
      name: door.name,
    })),
  };
}

async function matchingRuleIds(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  search: string,
  searchBy: "person" | "door",
) {
  const ids = new Set<Id<"accessRules">>();
  const limit = 100;
  let relationsRead = 0;
  if (searchBy === "person") {
    const { words, lookup } = personSearchTerms(search);
    const [firstNames, lastNames] = await Promise.all([
      ctx.db
        .query("employees")
        .withSearchIndex("search_first_name", (q) =>
          q.search("firstName", lookup).eq("projectId", projectId),
        )
        .take(limit + 1),
      ctx.db
        .query("employees")
        .withSearchIndex("search_last_name", (q) =>
          q.search("lastName", lookup).eq("projectId", projectId),
        )
        .take(limit + 1),
    ]);
    if (firstNames.length > limit || lastNames.length > limit) return null;
    const employees = [
      ...new Map(
        [...firstNames, ...lastNames].map((employee) => [
          employee._id,
          employee,
        ]),
      ).values(),
    ].filter(
      (employee) =>
        !employee.isVisitor &&
        words.every((word) =>
          `${employee.firstName} ${employee.lastName}`
            .toLocaleLowerCase("tr")
            .includes(word),
        ),
    );
    for (const employee of employees) {
      const members = await ctx.db
        .query("groupMembers")
        .withIndex("by_project_employee", (q) =>
          q.eq("projectId", projectId).eq("employeeId", employee._id),
        )
        .take(1001 - relationsRead);
      relationsRead += members.length;
      if (relationsRead > 1000) return null;
      members.forEach((member) => ids.add(member.groupId));
    }
  } else {
    const doors = await ctx.db
      .query("doors")
      .withSearchIndex("search_name", (q) =>
        q.search("name", search).eq("projectId", projectId),
      )
      .take(limit + 1);
    if (doors.length > limit) return null;
    const checkedPanels = new Map<string, boolean>();
    for (const door of doors) {
      const links = await ctx.db
        .query("groupDoors")
        .withIndex("by_door", (q) => q.eq("doorId", door._id))
        .take(1001 - relationsRead);
      relationsRead += links.length;
      if (relationsRead > 1000) return null;
      links.forEach((link) => ids.add(link.groupId));
      if (!door.deviceId) continue;
      const deviceId = door.deviceId;
      const device = await ctx.db.get(deviceId);
      if (!device || device.projectId !== projectId) continue;
      const deviceLinks = await ctx.db
        .query("groupDevices")
        .withIndex("by_project_device", (q) =>
          q.eq("projectId", projectId).eq("deviceId", deviceId),
        )
        .take(1001 - relationsRead);
      relationsRead += deviceLinks.length;
      if (relationsRead > 1000) return null;
      for (const link of deviceLinks) {
        const key = `${link.groupId}:${deviceId}`;
        let wholePanel = checkedPanels.get(key);
        if (wholePanel === undefined) {
          const selections = await ctx.db
            .query("groupDoors")
            .withIndex("by_group", (q) => q.eq("groupId", link.groupId))
            .take(101);
          if (selections.length > 100) return null;
          relationsRead += selections.length;
          if (relationsRead > 1000) return null;
          const liveDoors = await Promise.all(
            selections.map((selection) => ctx.db.get(selection.doorId)),
          );
          wholePanel = !liveDoors.some(
            (selected) =>
              selected?.projectId === projectId &&
              selected.deviceId === deviceId,
          );
          checkedPanels.set(key, wholePanel);
        }
        if (wholePanel) ids.add(link.groupId);
      }
    }
  }
  return ids;
}

async function listActiveRules(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  search: string,
  paginationOpts: PaginationOptions,
) {
  const scope = JSON.stringify([projectId, search, "active"]);
  const next = activeRuleCursor(paginationOpts.cursor, scope);
  const query = (phase: "active" | "legacy") => {
    const isActive = phase === "active" ? true : undefined;
    return search
      ? ctx.db
          .query("accessRules")
          .withSearchIndex("search_name", (q) =>
            q
              .search("name", search)
              .eq("projectId", projectId)
              .eq("isActive", isActive),
          )
      : ctx.db
          .query("accessRules")
          .withIndex("by_project_active", (q) =>
            q.eq("projectId", projectId).eq("isActive", isActive),
          )
          .order("desc");
  };
  // Eski undefined durumunu aktif tutarken pasif kayıtlar üzerinden sayfa taramayız.
  if (
    next.phase === "active" &&
    next.cursor === null &&
    !(await query("active").first())
  )
    next.phase = "legacy";
  const result = await query(next.phase).paginate({
    ...paginationOpts,
    cursor: next.cursor,
  });
  if (
    result.isDone &&
    next.phase === "active" &&
    (await query("legacy").first())
  ) {
    return {
      ...result,
      isDone: false,
      continueCursor: JSON.stringify({ scope, phase: "legacy", cursor: null }),
    };
  }
  return {
    ...result,
    continueCursor: JSON.stringify({
      scope,
      phase: next.phase,
      cursor: result.continueCursor,
    }),
  };
}

async function listTypedRules(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  search: string,
  type: "visitor" | "personnel",
  status: "all" | "active" | "inactive",
  paginationOpts: PaginationOptions,
) {
  const personnelTypes = type === "personnel" ? await personnelRuleTypes(after => ctx.db.query("accessRules")
    .withIndex("by_project_targetType", q => after ? q.eq("projectId", projectId).gt("targetType", after.value) : q.eq("projectId", projectId))
    .first()) : [];
  const stages = ruleTypeStages(type, status, personnelTypes);
  const query = (phase: number) => {
    const stage = stages[phase];
    if (!stage) throw new Error("Geçersiz sayfa");
    if (search) return ctx.db.query("accessRules").withSearchIndex("search_name", q => {
      const named = q.search("name", search).eq("projectId", projectId).eq("targetType", stage.targetType);
      return stage.isActive === "all" ? named : named.eq("isActive", stage.isActive);
    });
    const isActive = stage.isActive;
    return isActive === "all"
      ? ctx.db.query("accessRules").withIndex("by_project_targetType", q => q.eq("projectId", projectId).eq("targetType", stage.targetType)).order("desc")
      : ctx.db.query("accessRules").withIndex("by_project_targetType_isActive", q => q.eq("projectId", projectId).eq("targetType", stage.targetType).eq("isActive", isActive)).order("desc");
  };
  return pageRuleStages(stages.length, JSON.stringify([projectId, search, type, status, stages]), paginationOpts.cursor,
    (phase, cursor) => query(phase).paginate({ ...paginationOpts, cursor }),
    async phase => (await query(phase).first()) !== null);
}

/** Only aggregates leave the server; authorization matches the rule list. */
export const projectDeviceCounts = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await resolveProjectScope(ctx, projectId);
    const brands: Record<string, number> = {};
    let total = 0;
    for await (const device of ctx.db.query("devices").withIndex("by_project", q => q.eq("projectId", projectId))) {
      const brand = device.brand ?? "other";
      brands[brand] = (brands[brand] ?? 0) + 1;
      total += 1;
    }
    return { total, brands };
  },
});

export const listSummaries = authedQuery({
  args: {
    projectId: v.id("projects"),
    search: v.optional(v.string()),
    searchBy: v.optional(
      v.union(v.literal("rule"), v.literal("person"), v.literal("door")),
    ),
    type: v.optional(v.union(v.literal("all"), v.literal("visitor"), v.literal("personnel"))),
    status: v.optional(
      v.union(v.literal("all"), v.literal("active"), v.literal("inactive")),
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const search = args.search?.trim() ?? "";
    const searchBy = args.searchBy ?? "rule";
    const status = args.status ?? "all";
    const type = args.type ?? "all";
    const matchedIds =
      search && searchBy !== "rule"
        ? await matchingRuleIds(ctx, args.projectId, search, searchBy)
        : undefined;
    const searchLimited = matchedIds === null;
    const paginationOpts = {
      ...args.paginationOpts,
      numItems: Math.min(20, Math.max(1, args.paginationOpts.numItems)),
    };
    const result =
      matchedIds !== undefined
        ? pageRuleCandidates(
            (
              await Promise.all(
                [...(matchedIds ?? [])].map((id) => ctx.db.get(id)),
              )
            )
              .filter((rule): rule is NonNullable<typeof rule> => rule !== null)
              .filter(
                (rule) =>
                  rule.projectId === args.projectId &&
                  matchesRuleStatus(rule.isActive, status) && matchesRuleType(rule.targetType, type),
              ),
            args.paginationOpts.cursor,
            paginationOpts.numItems,
            JSON.stringify([args.projectId, search, searchBy, status, type]),
          )
        : type !== "all"
          ? await listTypedRules(ctx, args.projectId, search, type, status, paginationOpts)
        : status === "active"
          ? await listActiveRules(ctx, args.projectId, search, paginationOpts)
          : await (
              search && searchBy === "rule"
                ? ctx.db
                    .query("accessRules")
                    .withSearchIndex("search_name", (q) => {
                      const named = q
                        .search("name", search)
                        .eq("projectId", args.projectId);
                      return status === "inactive"
                        ? named.eq("isActive", false)
                        : named;
                    })
                : status === "inactive"
                  ? ctx.db
                      .query("accessRules")
                      .withIndex("by_project_active", (q) =>
                        q.eq("projectId", args.projectId).eq("isActive", false),
                      )
                      .order("desc")
                  : ctx.db
                      .query("accessRules")
                      .withIndex("by_project", (q) =>
                        q.eq("projectId", args.projectId),
                      )
                      .order("desc")
            ).paginate(paginationOpts);
    const matching = searchLimited
      ? []
      : result.page.filter((rule) => matchesRuleStatus(rule.isActive, status));
    const page = await Promise.all(
      matching.map(async (rule) => {
        const [members, scope] = await Promise.all([
          ctx.db
            .query("groupMembers")
            .withIndex("by_project_group", (q) =>
              q.eq("projectId", rule.projectId).eq("groupId", rule._id),
            )
            .take(SUMMARY_MEMBER_LIMIT + 1),
          readRuleScope(ctx, rule, false),
        ]);
        return {
          ...rule,
          memberCount: Math.min(SUMMARY_MEMBER_LIMIT, members.length),
          memberCountTruncated: members.length > SUMMARY_MEMBER_LIMIT,
          panels: scope.panels,
          unassignedDoors: scope.unassignedDoors,
          scopeTruncated: scope.scopeTruncated,
        };
      }),
    );
    return {
      ...result,
      page,
      isDone: searchLimited || result.isDone,
      searchLimited,
    };
  },
});

export const getDetails = authedQuery({
  args: {
    ruleId: v.id("accessRules"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowed = await resolveProjectScope(ctx, args.projectId);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || !rule.projectId || !allowed.includes(rule.projectId))
      throw new Error("Kural bulunamadı veya bu kurala erişim yetkiniz yok");
    const [members, scope] = await Promise.all([
      ctx.db
        .query("groupMembers")
        .withIndex("by_project_group", (q) =>
          q.eq("projectId", rule.projectId).eq("groupId", rule._id),
        )
        .take(RULE_DETAILS_MEMBER_LIMIT + 1),
      readRuleScope(ctx, rule, true),
    ]);
    const groupMembers = await Promise.all(
      members.slice(0, RULE_DETAILS_MEMBER_LIMIT).map(async (member) => {
        const employee = await ctx.db.get(member.employeeId);
        return {
          ...member,
          employees:
            employee && employee.projectId === rule.projectId
              ? {
                  id: employee._id,
                  firstName: employee.firstName,
                  lastName: employee.lastName,
                  email: employee.email,
                }
              : null,
        };
      }),
    );
    return { ...rule, ...scope, groupMembers, membersTruncated: members.length > RULE_DETAILS_MEMBER_LIMIT };
  },
});

/** Each cursor belongs to one rule and kind; editors save explicit relation diffs. */
export const listRuleMembers = authedQuery({
  args: {
    ruleId: v.id("accessRules"),
    kind: v.union(v.literal("people"), v.literal("devices"), v.literal("doors")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.ruleId);
    if (!rule?.projectId) throw new Error("Kural bulunamadı");
    await resolveProjectScope(ctx, rule.projectId);
    if (!Number.isFinite(args.paginationOpts.numItems)) throw new Error("Geçersiz sayfa boyutu");
    const paginationOpts = { ...args.paginationOpts, numItems: Math.max(1, Math.min(50, Math.floor(args.paginationOpts.numItems))) };
    if (args.kind === "people") {
      const result = await ctx.db.query("groupMembers")
        .withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", rule._id))
        .paginate(paginationOpts);
      const page = await Promise.all(result.page.map(async member => {
        const employee = await ctx.db.get(member.employeeId);
        return { ...member, employees: employee && employee.projectId === rule.projectId
          ? { id: employee._id, firstName: employee.firstName, lastName: employee.lastName, email: employee.email } : null };
      }));
      return { ...result, kind: "people" as const, page };
    }
    if (args.kind === "devices") {
      const result = await ctx.db.query("groupDevices")
        .withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", rule._id))
        .paginate(paginationOpts);
      const page = await Promise.all(result.page.map(async member => {
        const device = await ctx.db.get(member.deviceId);
        return { ...member, devices: device && device.projectId === rule.projectId
          ? { id: device._id, name: device.name, brand: device.brand, ideUuid: device.ideUuid,
              deviceSerial: device.deviceSerial, zoneId: device.zoneId, doorId: device.doorId } : null };
      }));
      return { ...result, kind: "devices" as const, page };
    }
    const result = await ctx.db.query("groupDoors")
      .withIndex("by_group", q => q.eq("groupId", rule._id)).paginate(paginationOpts);
    const page = await Promise.all(result.page.map(async member => {
      const door = await ctx.db.get(member.doorId);
      return { ...member, doors: door && door.projectId === rule.projectId
        ? { doorId: door._id, deviceId: door.deviceId, name: door.name } : null };
    }));
    return { ...result, kind: "doors" as const, page };
  },
});

export const create = authedMutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    targetType: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    days: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
    accessDirection: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    isTemplate: v.optional(v.boolean()),
    templateName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "accessRules.manage");
    await resolveProjectScope(ctx, args.projectId);
    if (!args.projectId) throw new Error("Önce bir proje seçin");
    assertAccessSchedule(args);
    if (!args.name.trim()) throw new Error("Kural adı zorunludur");
    const now = new Date().toISOString();
    const ruleId = await ctx.db.insert("accessRules", {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return ruleId;
  },
});

export const update = authedMutation({
  args: {
    ruleId: v.id("accessRules"),
    name: v.optional(v.string()),
    targetType: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.union(v.null(), v.string())),
    endTime: v.optional(v.union(v.null(), v.string())),
    days: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
    accessDirection: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    isTemplate: v.optional(v.boolean()),
    templateName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Kural bulunamadı");
    await requirePermission(ctx, ctx.user, rule.projectId, "accessRules.manage");
    await resolveProjectScope(ctx, rule.projectId);
    if (!rule.projectId) throw new Error("Önce kuralı bir projeye atayın");
    if (rule.projectId && !allowedProjectIds.some((id) => id === rule.projectId)) {
      throw new Error("Bu kurala erişim yetkiniz yok");
    }
    await validateRuleAccessRelations(ctx, rule);
    const { ruleId, ...updates } = args;
    const clean = { ...toPatch(updates), updatedAt: new Date().toISOString() };
    assertAccessScheduleUpdate(rule, updates);
    if (updates.name !== undefined && !updates.name.trim()) throw new Error("Kural adı zorunludur");
    const hikMembers = updates.isActive === false ? await ctx.db.query("groupMembers").withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", ruleId)).take(4097) : [];
    if (hikMembers.length > 4096) throw new Error("Kural üye sınırı aşıldı");
    const hikSnapshots = await snapshotRuleHikEmployees(ctx, hikMembers.map(member => member.employeeId), rule.projectId, hikMembers.length ? await ruleHikDevices(ctx, rule) : []);
    await ctx.db.patch(ruleId, clean);
    await reconcileRuleSnapshots(ctx, hikSnapshots);

    // Plan-ilişkili alanlardan biri değiştiyse week plan'ı cihazlara yeniden yaz.
    const planAffected =
      updates.startTime !== undefined ||
      updates.endTime !== undefined ||
      updates.days !== undefined ||
      updates.isActive !== undefined;
    if (planAffected) {
      await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, {
        accessRuleId: ruleId,
        ...(updates.isActive === false ? { targetEmployeeIds: [] } : {}),
      });
      await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncPermissionToIdePanels, {
        accessRuleId: ruleId,
      });
    }
    // Kural deaktif edildiğinde IDE panellerindeki kart kayıtlarını sök.
    // syncPermissionToIdePanels permission kaydını günceller ama fiziksel kartı kaldırmaz.
    if (updates.isActive === false) {
      const idePanels = await resolveRuleIdeDeviceIds(ctx, ruleId, rule.projectId);
      await Promise.all(
        idePanels.map((panelId) =>
          reconcilePanelRosterIde(ctx, { deviceId: panelId, projectId: rule.projectId }),
        ),
      );
    }
    // Kural yeniden aktif edildiğinde üye kartlarını IDE panellerine GERİ YAZ — deaktivasyon
    // dalıyla simetrik. syncPermissionToIdePanels yalnız permission RECORD'unu yazar; bunun
    // tek başına çalışması kullanıcı kartlarını panele döndürmez (R6). Push hattı cihaz bağını
    // yazar; salt kapı bağıyla yetkili üye getEmployeeWithDevices kapsamı dışında kalır
    // (sistem geneli, bilinçli asimetri).
    if (updates.isActive === true) {
      // Önce kuralın IDE paneli var mı çöz (deaktivasyon dalıyla simetrik). Hikvision-only
      // kuralda atla: aksi halde her üye için syncEmployeeToIdePanels boşa schedule edilir
      // (action zaten panelsiz no-op'tur ama N kuyruk işi üretmemek için erken çıkıyoruz).
      const idePanels = await resolveRuleIdeDeviceIds(ctx, ruleId, rule.projectId);
      if (idePanels.length > 0) {
        const members = await ctx.db
          .query("groupMembers")
          .withIndex("by_project_group", (q) =>
            q.eq("projectId", rule.projectId).eq("groupId", ruleId),
          )
          .collect();
        await Promise.all(
          members.map((m) =>
            ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, {
              employeeId: m.employeeId,
            }),
          ),
        );
      }
    }
    return ruleId;
  },
});

export const remove = authedMutation({
  args: { ruleId: v.id("accessRules") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Kural bulunamadı");
    await requirePermission(ctx, ctx.user, rule.projectId, "accessRules.manage");
    if (rule.projectId ? !isProjectAllowed(allowedProjectIds, rule.projectId) : ctx.user.role !== "super_admin") {
      throw new Error("Bu kurala erişim yetkiniz yok");
    }
    // Validate every relation before the first delete or scheduler effect.
    const [members, devices, doors] = await Promise.all([
      ctx.db.query("groupMembers").withIndex("by_group", q => q.eq("groupId", args.ruleId)).collect(),
      ctx.db.query("groupDevices").withIndex("by_group", q => q.eq("groupId", args.ruleId)).collect(),
      ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", args.ruleId)).collect(),
    ]);
    for (const link of [...members, ...devices, ...doors]) {
      if (ctx.user.role !== "super_admin" &&
        (!isProjectAllowed(allowedProjectIds, link.projectId) || link.projectId !== rule.projectId)) {
        throw new Error("Bu kayda erişim yetkiniz yok");
      }
    }
    for (const member of members) {
      const employee = await ctx.db.get(member.employeeId);
      if (employee && !canAccessEmployeeProject(ctx.user.role, allowedProjectIds, employee.projectId)) {
        throw new Error("Bu çalışanın projesine erişim yetkiniz yok");
      }
    }
    for (const link of devices) {
      const device = await ctx.db.get(link.deviceId);
      if (device && ctx.user.role !== "super_admin" && !isProjectAllowed(allowedProjectIds, device.projectId)) {
        throw new Error("Bu cihaza erişim yetkiniz yok");
      }
    }
    for (const link of doors) {
      const door = await ctx.db.get(link.doorId);
      if (!door) continue;
      if (ctx.user.role !== "super_admin" && !isProjectAllowed(allowedProjectIds, door.projectId)) {
        throw new Error("Bu kapıya erişim yetkiniz yok");
      }
      if (door.deviceId) {
        const device = await ctx.db.get(door.deviceId);
        if (device && ctx.user.role !== "super_admin" && !isProjectAllowed(allowedProjectIds, device.projectId)) {
          throw new Error("Bu cihaza erişim yetkiniz yok");
        }
      }
    }
    const candidatePanels = await resolveRuleIdeDeviceIds(ctx, args.ruleId, rule.projectId);
    const affectedEmployeeIds = members.map(m => m.employeeId);
    const hikSnapshots = await snapshotRuleHikEmployees(ctx, affectedEmployeeIds, rule.projectId, await ruleHikDevices(ctx, rule));
    await Promise.all([...members, ...devices, ...doors].map(link => ctx.db.delete(link._id)));

    await ctx.db.delete(args.ruleId);

    await reconcileRuleSnapshots(ctx, hikSnapshots, candidatePanels);

    // Etkilenen üyeleri yeniden sync et — kalan kurallarına göre RightPlan
    // güncellensin, hiç kuralı kalmadıysa cihazdan sökülecek (Phase 5 reconcile).
    // IDE: salt syncEmployeeToIdePanels YETMEZ — kalan IDE bağı olmayan üyede sessiz
    // no-op kalır ve kart panelde yaşardı (silinmiş kuralla geçiş). Silme-öncesi
    // candidatePanels ile gerçek orphan'lardan kart sökülür; helper kalan paneller
    // için syncEmployeeToIdePanels'ı zaten kendisi schedule eder.

  },
});

export const createWithGroups = authedMutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    targetType: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    days: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
    accessDirection: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    employeeIds: v.optional(v.array(v.id("employees"))),
    deviceIds: v.optional(v.array(v.id("devices"))),
    doorIds: v.optional(v.array(v.id("doors"))),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "accessRules.manage");
    return await createAccessRuleWithGroups(ctx, args);
  },
});

const updateWithGroupsArgs = {
    ruleId: v.id("accessRules"),
    name: v.optional(v.string()),
    targetType: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.union(v.null(), v.string())),
    endTime: v.optional(v.union(v.null(), v.string())),
    days: v.optional(v.array(v.string())),
    priority: v.optional(v.number()),
    accessDirection: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    employeeIds: v.optional(v.array(v.id("employees"))),
    deviceIds: v.optional(v.array(v.id("devices"))),
    doorIds: v.optional(v.array(v.id("doors"))),
    projectId: v.optional(v.id("projects")),
    relationDiff: v.optional(v.object({
      employees: v.object({ added: v.array(v.id("employees")), removed: v.array(v.id("employees")) }),
      devices: v.object({ added: v.array(v.id("devices")), removed: v.array(v.id("devices")) }),
      doors: v.object({ added: v.array(v.id("doors")), removed: v.array(v.id("doors")) }),
    })),
};
const updateWithGroupsValidator = v.object(updateWithGroupsArgs);
type UpdateWithGroupsArgs = Infer<typeof updateWithGroupsValidator>;
async function saveWithGroups(
  ctx: MutationCtx & { user: Doc<"users"> },
  args: UpdateWithGroupsArgs,
): Promise<{ ruleId: Id<"accessRules">; runId: Id<"deviceSyncRuns"> | null }> {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Kural bulunamadı");
    await requirePermission(ctx, ctx.user, rule.projectId, "accessRules.manage");
    await resolveProjectScope(ctx, rule.projectId);
    if (!rule.projectId) throw new Error("Önce kuralı bir projeye atayın");
    if (rule.projectId && !allowedProjectIds.some((id) => id === rule.projectId)) {
      throw new Error("Bu kurala erişim yetkiniz yok");
    }
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    assertAccessProjectUnchanged(rule.projectId, args.projectId);
    const { ruleId, relationDiff, employeeIds: replacementEmployees, deviceIds: replacementDevices, doorIds: replacementDoors, projectId: _ignoredProjectId, ...updates } = args;
    const hasReplacement = replacementEmployees !== undefined || replacementDevices !== undefined || replacementDoors !== undefined;
    if (relationDiff && hasReplacement) {
      throw new ConvexError({ code: "RULE_DIFF_MIXED_MODE", message: "Tam liste ve ilişki farkı aynı istekte gönderilemez." });
    }
    // Guard legacy clients BEFORE validation scans, patches or relationship deletion.
    if (hasReplacement) {
      const [members, devices, doors] = await Promise.all([
        ctx.db.query("groupMembers").withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", ruleId)).take(RULE_DETAILS_MEMBER_LIMIT + 1),
        ctx.db.query("groupDevices").withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", ruleId)).take(RULE_DETAILS_RELATION_LIMIT + 1),
        ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", ruleId)).take(RULE_DETAILS_RELATION_LIMIT + 1),
      ]);
      assertLegacyRuleReplacement({ members: members.length, devices: devices.length, doors: doors.length });
    }
    const [oldMembers, oldDevices, oldDoors] = await Promise.all([
      ctx.db.query("groupMembers").withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", ruleId)).collect(),
      ctx.db.query("groupDevices").withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", ruleId)).collect(),
      ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", ruleId)).collect(),
    ]);
    const oldEmployeeIds = oldMembers.map(m => m.employeeId);
    const employeeIds = relationDiff
      ? (rule.targetType === "visitor" ? undefined : applyRelationDiff(oldEmployeeIds, relationDiff.employees))
      : replacementEmployees;
    const deviceIds = relationDiff ? applyRelationDiff(oldDevices.map(d => d.deviceId), relationDiff.devices) : replacementDevices;
    let doorIds = relationDiff ? applyRelationDiff(oldDoors.map(d => d.doorId), relationDiff.doors) : replacementDoors;
    if (relationDiff && doorIds) {
      const removedDevices = new Set(relationDiff.devices.removed);
      const doors = await Promise.all(doorIds.map(id => ctx.db.get(id)));
      const doorDeviceById = new Map(doors.filter((d): d is NonNullable<typeof d> => d !== null).map(d => [d._id, d.deviceId]));
      doorIds = retainedDiffDoorIds(doorIds, doorDeviceById, removedDevices, new Set(relationDiff.doors.added));
    }
    await validateRuleAccessRelations(ctx, rule, { employeeIds, deviceIds, doorIds });
    const now = new Date().toISOString();
    assertAccessScheduleUpdate(rule, updates);
    if (updates.name !== undefined && !updates.name.trim()) throw new Error("Kural adı zorunludur");
    // Member removals affect only those members. Scope removals affect only old
    // devices touched by a removed device/door; resolve the rule graph once.
    const removedMembers = employeeIds === undefined ? [] : diffIds(oldEmployeeIds, employeeIds).removed;
    const removedDevices = deviceIds === undefined ? [] : diffIds(oldDevices.map(d => d.deviceId), deviceIds).removed;
    const removedDoors = doorIds === undefined ? [] : diffIds(oldDoors.map(d => d.doorId), doorIds).removed;
    const affectedDeviceIds = new Set(removedDevices);
    for (const link of oldDoors.filter(link => removedDoors.includes(link.doorId))) {
      const door = await ctx.db.get(link.doorId);
      if (link.deviceId) affectedDeviceIds.add(link.deviceId);
      if (door?.deviceId) affectedDeviceIds.add(door.deviceId);
    }
    const allHikDevices = removedMembers.length || affectedDeviceIds.size || updates.isActive === false ? await ruleHikDevices(ctx, rule) : [];
    const affectedMembers = updates.isActive === false || affectedDeviceIds.size ? oldEmployeeIds : removedMembers;
    const hikSnapshots = await snapshotRuleHikEmployees(ctx, affectedMembers, rule.projectId, allHikDevices);
    for (const [employeeId, snapshot] of hikSnapshots) {
      if (updates.isActive !== false && !removedMembers.includes(employeeId)) snapshot.devices = snapshot.devices.filter(device => affectedDeviceIds.has(device._id));
    }
    await ctx.db.patch(ruleId, { ...toPatch(updates), updatedAt: now });
    const ruleIdePanelsBefore = await resolveRuleIdeDeviceIds(ctx, ruleId, rule.projectId);

    if (employeeIds !== undefined && rule.targetType !== "visitor") {
      const changed = diffIds(oldEmployeeIds, employeeIds);
      await Promise.all(oldMembers.filter(m => changed.removed.includes(m.employeeId)).map((m) => ctx.db.delete(m._id)));
      await Promise.all(
        changed.added.map((empId) =>
          ctx.db.insert("groupMembers", {
            groupId: ruleId,
            employeeId: empId,
            projectId: rule.projectId,
            createdAt: now,
          })
        )
      );
    }

    const removedIdePanels: Id<"devices">[] = [];
    if (deviceIds !== undefined) {
      const changed = diffIds(oldDevices.map(d => d.deviceId), deviceIds);
      await Promise.all(oldDevices.filter(d => changed.removed.includes(d.deviceId)).map((d) => ctx.db.delete(d._id)));
      await Promise.all(
        changed.added.map((devId) =>
          ctx.db.insert("groupDevices", {
            groupId: ruleId,
            deviceId: devId,
            projectId: rule.projectId,
            createdAt: now,
          })
        )
      );
      const removedDeviceIds = diffIds(
        oldDevices.map((d) => d.deviceId),
        deviceIds,
      ).removed;
      for (const devId of removedDeviceIds) {
        const device = await ctx.db.get(devId);
        if (device && device.isActive && device.brand === "ide_smart") {
          removedIdePanels.push(devId);
        }
      }
      // Yalnız deviceIds verilen (API) çağrıda çıkarılan cihazların kapı bağlarını da
      // temizle. Diff yolu kapıları da açık farkla yönetir; eşzamanlı eklenen kapı korunur.
      if (doorIds === undefined && removedDeviceIds.length > 0) {
        await deleteStaleGroupDoors(ctx, ruleId, new Set(removedDeviceIds));
      }
    }

    // Kural bazlı kapı seçimi (IDE permission.io kaynağı): yalnız değişen bağları yaz.
    // io güncellemesi aşağıdaki syncPermissionToIdePanels ile panele yansır.
    if (doorIds !== undefined) {
      const changed = diffIds(oldDoors.map(d => d.doorId), doorIds);
      await Promise.all(oldDoors.filter(d => changed.removed.includes(d.doorId)).map((d) => ctx.db.delete(d._id)));
      await Promise.all(
        changed.added.map(async (doorId) => {
          const door = await ctx.db.get(doorId);
          await ctx.db.insert("groupDoors", {
            groupId: ruleId,
            doorId,
            deviceId: door?.deviceId,
            projectId: rule.projectId,
            createdAt: now,
          });
        })
      );
    }

    // Düzenleme-SONRASI: kalan ve çıkarılan üyeler.
    const survivingMemberIds =
      employeeIds !== undefined && rule.targetType !== "visitor" ? employeeIds : oldEmployeeIds;
    const removedEmployeeIds =
      employeeIds !== undefined && rule.targetType !== "visitor" ? diffIds(oldEmployeeIds, employeeIds).removed : [];

    const deviceChanges = diffIds(oldDevices.map(d => d.deviceId), deviceIds ?? oldDevices.map(d => d.deviceId));
    const doorChanges = diffIds(oldDoors.map(d => d.doorId), doorIds ?? oldDoors.map(d => d.doorId));
    const diffPlan = ruleDiffSyncPlan({
      live: oldEmployeeIds,
      next: survivingMemberIds,
      scopeChanged: deviceChanges.added.length + deviceChanges.removed.length + doorChanges.added.length + doorChanges.removed.length > 0,
      settingsChanged: Object.entries(updates).some(([key, value]) => value !== undefined && JSON.stringify(value ?? undefined) !== JSON.stringify(rule[key as keyof typeof rule])),
      activeChanged: updates.isActive !== undefined && updates.isActive !== rule.isActive,
      missingWeekPlan: !rule.hikWeekPlanNo,
    });
    if (relationDiff) {
      const hikDeletions = [];
      for (const [employeeId, snapshot] of hikSnapshots) {
        const plan = hikSnapshots.size > HIK_RECONCILE_BATCH ? { snapshot } : await planRemovedEmployeeHik(ctx, employeeId, snapshot);
        if (plan?.snapshot.devices.length) hikDeletions.push({ employeeId, snapshot: plan.snapshot });
      }
      const oldDoorDocs = await Promise.all(oldDoors.map(d => ctx.db.get(d.doorId)));
      const beforeDeviceIds = [...new Set([...oldDevices.map(d => d.deviceId),
        ...oldDoorDocs.flatMap(d => d?.deviceId ? [d.deviceId] : [])])];
      const runId = await createRuleDiffRun(ctx, {
        ruleId, projectId: rule.projectId, startedBy: ctx.user._id,
        beforeDeviceIds, plan: diffPlan, hikDeletions,
      });
      return { ruleId, runId };
    }
    await reconcileRuleSnapshots(ctx, hikSnapshots);
    const syncJobs: Promise<unknown>[] = [];
    if (!relationDiff || diffPlan.syncRule) {
      syncJobs.push(
        ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, { accessRuleId: ruleId, ...(updates.isActive === false ? { targetEmployeeIds: [] } : {}) }),
        ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncPermissionToIdePanels, { accessRuleId: ruleId }),
      );
    }

    // Çıkarılan üyeler: kuralın eski panellerinden orphan kart sökülür, başka kuralla erişilen
    // panellerde permissions[] AZALTILIR (kişi silinmez).
    for (const empId of removedEmployeeIds) {
      syncJobs.push(
        reconcileRemovedEmployeeIde(ctx, {
          employeeId: empId,
          projectId: rule.projectId,
          candidatePanels: ruleIdePanelsBefore,
        }),
      );
    }

    // Kalan üyeler: güncel kuralla yeniden sync + (varsa) çıkarılan cihazlardan orphan reconcile.
    // Yalnız üye listesi değiştiğinde veya bir IDE paneli çıkarıldığında gerek var (sadece
    // saat/gün değişiminde syncPermissionToIdePanels yeterli).
    if (relationDiff || employeeIds !== undefined || removedIdePanels.length > 0) {
      for (const empId of relationDiff ? diffPlan.syncMembers : survivingMemberIds) {
        syncJobs.push(
          ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
            employeeId: empId,
          }),
          reconcileRemovedEmployeeIde(ctx, {
            employeeId: empId,
            projectId: rule.projectId,
            candidatePanels: relationDiff && diffPlan.reconcileRoster ? ruleIdePanelsBefore : removedIdePanels,
          }),
        );
      }
    }

    // Salt reaktivasyon: üye listesi ve panel değişmeden isActive:true yapıldığında yukarıdaki
    // kalan-üye döngüsü (employeeIds !== undefined || removedIdePanels.length > 0 koşulu)
    // atlandığından kartlar panele geri yazılmaz. update() mutation'ıyla simetrik olarak mevcut
    // üyeleri IDE panellerine geri push et. Döngünün çalıştığı durumlarda zaten reconcileRemoved
    // EmployeeIde → syncEmployeeToIdePanels schedule ettiğinden burada tekrar etme.
    if (
      !relationDiff &&
      updates.isActive === true &&
      employeeIds === undefined &&
      removedIdePanels.length === 0
    ) {
      for (const empId of survivingMemberIds) {
        syncJobs.push(
          ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, {
            employeeId: empId,
          }),
        );
      }
    }

    // Roster eşitleme: üye/cihaz/kapı veya isActive değiştiğinde paneldeki hayalet
    // kartları sök (isActive-only API çağrısında atlanırsa pasif kuralın kartları
    // panelde kalırdı — update() mutation'daki muadiliyle simetrik). Salt isim/saat/gün
    // güncellemelerinde (roster değişmez) atla.
    const rosterChanged = relationDiff ? diffPlan.reconcileRoster :
      employeeIds !== undefined ||
      deviceIds !== undefined ||
      doorIds !== undefined ||
      updates.isActive !== undefined;
    if (rosterChanged) {
      // Panel listesi değişmediyse (deviceIds/doorIds dokunulmadı) ikinci DB gezisi gereksiz —
      // daha önce yakalanan ruleIdePanelsBefore ile aynı sonuç.
      const ideePanelsNow =
        deviceIds === undefined && doorIds === undefined
          ? ruleIdePanelsBefore
          : await resolveRuleIdeDeviceIds(ctx, ruleId, rule.projectId);
      for (const panelId of ideePanelsNow) {
        syncJobs.push(
          reconcilePanelRosterIde(ctx, { deviceId: panelId, projectId: rule.projectId }),
        );
      }
    }

    await Promise.all(syncJobs);

    return { ruleId, runId: null };
}

/** Old clients keep the Id return shape. Diff saves still get durable tracking. */
export const updateWithGroups = authedMutation({
  args: updateWithGroupsValidator.fields,
  handler: async (ctx, args): Promise<Id<"accessRules">> => (await saveWithGroups(ctx, args)).ruleId,
});

/** Same transaction, with the run reference for the editor's result link. */
export const updateWithGroupsTracked = authedMutation({
  args: updateWithGroupsValidator.fields,
  handler: async (ctx, args): Promise<{ ruleId: Id<"accessRules">; runId: Id<"deviceSyncRuns"> | null }> => {
    if (!args.relationDiff) throw new ConvexError("İzlenen kayıt için ilişki farkı gerekli");
    return await saveWithGroups(ctx, args);
  },
});
