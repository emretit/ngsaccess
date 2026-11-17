// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { loadPdksRulePolicy } from "./lib/pdksRules";
import { resolveAttendanceEvidence } from "./lib/pdksEvidence";
const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Legacy" });
    const actorUserId = await ctx.db.insert("users", { role: "super_admin" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "IDE", createdAt: "", updatedAt: "" });
    const versionId = await ctx.db.insert("pdksRuleVersions", { projectId, effectiveFrom: "2026-10-01", calculationMode: "firstLast", minPunchIntervalMinutes: 3, punchMode: "legacy", checkpointMode: "selected", createdAt: "original", createdBy: actorUserId, requireCheckIn: false, requireCheckOut: false, noPunch: "absent", missingRequiredPunch: "absent" });
    // Stored addresses are copied even if today's hardware no longer exists.
    await ctx.db.insert("pdksCheckpointSelections", { projectId, ruleVersionId: versionId, deviceId, targetType: "device", pointType: "both" });
    await ctx.db.insert("pdksCheckpointSelections", { projectId, ruleVersionId: versionId, deviceId, targetType: "reader", hikReaderNo: 7, pointType: "exit" });
    await ctx.db.insert("pdksCheckpointSelections", { projectId, ruleVersionId: versionId, deviceId, targetType: "door", ioId: 4, pointType: "entry" });
    await ctx.db.delete(deviceId);
    return { projectId, actorUserId, versionId };
  });
  return { t, ...ids };
}

it("previews without writes, preserves history/settings/addresses and is idempotent", async () => {
  const f = await fixture();
  const before = await f.t.run(async ctx => ({ versions: await ctx.db.query("pdksRuleVersions").collect(), targets: await ctx.db.query("pdksCheckpointSelections").collect() }));
  const preview = await f.t.query(internal.dataMigrations.previewPdksRequirementsSwitch, {});
  expect(preview.projects).toMatchObject([{ projectId: f.projectId, skipReason: null, sourceVersion: { _id: f.versionId, punchMode: "legacy" } }]);
  expect(await f.t.run(ctx => ctx.db.query("pdksRuleVersions").collect())).toEqual(before.versions);
  const first = await f.t.mutation(internal.dataMigrations.switchProjectsToRequirements, { actorUserId: f.actorUserId });
  expect(first.created).toHaveLength(1);
  const after = await f.t.run(async ctx => ({ versions: await ctx.db.query("pdksRuleVersions").collect(), targets: await ctx.db.query("pdksCheckpointSelections").collect() }));
  expect(after.versions.find(v => v._id === f.versionId)).toEqual(before.versions[0]);
  expect(after.versions.find(v => v._id !== f.versionId)).toMatchObject({ effectiveFrom: "2026-11-18", calculationMode: "firstLast", minPunchIntervalMinutes: 3, checkpointMode: "selected", punchMode: "requirements", requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review", noPunch: "review" });
  expect(after.targets.filter(v => v.ruleVersionId === f.versionId)).toEqual(before.targets);
  const fields = (rows: typeof before.targets) => rows.map(({ _id, _creationTime, ruleVersionId, ...rest }) => rest);
  expect(fields(after.targets.filter(v => v.ruleVersionId !== f.versionId))).toEqual(fields(before.targets));
  const second = await f.t.mutation(internal.dataMigrations.switchProjectsToRequirements, { actorUserId: f.actorUserId });
  expect(second.created).toEqual([]);
  expect(await f.t.run(async ctx => ({ versions: await ctx.db.query("pdksRuleVersions").collect(), targets: await ctx.db.query("pdksCheckpointSelections").collect() }))).toEqual(after);
});

it("resolves Nov 17 as legacy and Nov 18 single/no punches as review", async () => {
  const f = await fixture();
  await f.t.mutation(internal.dataMigrations.switchProjectsToRequirements, { actorUserId: f.actorUserId });
  const decisions = await f.t.run(async ctx => {
    const policyFor = await loadPdksRulePolicy(ctx, f.projectId, "2026-11-17", "2026-11-18");
    return ["2026-11-17", "2026-11-18"].map(date => {
      const policy = policyFor(date);
      return { mode: policy.punchMode, single: resolveAttendanceEvidence([{ accessTime: `${date}T05:00:00.000Z`, direction: "entry" }], undefined, policy), empty: resolveAttendanceEvidence([], undefined, policy) };
    });
  });
  expect(decisions[0]).toMatchObject({ mode: "legacy", single: { decision: "present", durationMeasured: false }, empty: { decision: "absent" } });
  expect(decisions[1]).toMatchObject({ mode: "requirements", single: { decision: "incomplete", attendanceCredit: false }, empty: { decision: "incomplete" } });
});

it("creates the no-version baseline and skips requirements or any existing switch-date version", async () => {
  const f = await fixture();
  const ids = await f.t.run(async ctx => {
    const baseline = await ctx.db.insert("projects", { name: "No version" });
    const requirements = await ctx.db.insert("projects", { name: "Requirements" });
    const occupied = await ctx.db.insert("projects", { name: "Occupied" });
    for (const [projectId, effectiveFrom, punchMode] of [[requirements, "2026-11-01", "requirements"], [occupied, "2026-11-18", "legacy"]] as const) {
      await ctx.db.insert("pdksRuleVersions", { projectId, effectiveFrom, punchMode, checkpointMode: "all", createdAt: "", createdBy: f.actorUserId });
    }
    return { baseline, requirements, occupied };
  });
  const result = await f.t.mutation(internal.dataMigrations.switchProjectsToRequirements, { actorUserId: f.actorUserId });
  expect(result.created.map(v => v.projectId)).toEqual([f.projectId, ids.baseline]);
  expect(result.skipped).toEqual([{ projectId: ids.requirements, reason: "alreadyRequirements" }, { projectId: ids.occupied, reason: "versionAtSwitchDate" }]);
  const policies = await f.t.run(async ctx => {
    const resolve = await loadPdksRulePolicy(ctx, ids.baseline, "2026-11-17", "2026-11-18");
    return [resolve("2026-11-17"), resolve("2026-11-18")];
  });
  expect(policies[0]).toMatchObject({ punchMode: "legacy", checkpointMode: "all", targets: [] });
  expect(policies[1]).toMatchObject({ punchMode: "requirements", checkpointMode: "all", targets: [], noPunch: "review" });
});

it("copies boundary settings/targets and normalizes future legacy versions without changing their settings/targets", async () => {
  const f = await fixture();
  const original = await f.t.run(async ctx => {
    const versionId = await ctx.db.insert("pdksRuleVersions", { projectId: f.projectId, effectiveFrom: "2026-11-17", punchMode: "legacy", calculationMode: "firstLast", minPunchIntervalMinutes: 4, checkpointMode: "selected", createdAt: "source", createdBy: f.actorUserId });
    const oldTargets = await ctx.db.query("pdksCheckpointSelections").collect();
    for (const { _id, _creationTime, ruleVersionId: _oldVersion, ...target } of oldTargets) await ctx.db.insert("pdksCheckpointSelections", { ...target, ruleVersionId: versionId });
    const future = await ctx.db.insert("pdksRuleVersions", { projectId: f.projectId, effectiveFrom: "2026-12-01", punchMode: "legacy", calculationMode: "eachPunch", minPunchIntervalMinutes: 5, checkpointMode: "selected", requireCheckIn: false, requireCheckOut: false, missingRequiredPunch: "absent", noPunch: "absent", createdAt: "future", createdBy: f.actorUserId });
    const device = oldTargets[0];
    if (!device) throw new Error("Missing target");
    await ctx.db.insert("pdksCheckpointSelections", { projectId: f.projectId, ruleVersionId: future, targetType: "device", deviceId: device.deviceId, pointType: "entry" });
    return { versions: await ctx.db.query("pdksRuleVersions").collect(), targets: await ctx.db.query("pdksCheckpointSelections").collect(), versionId, future };
  });
  const preview = await f.t.query(internal.dataMigrations.previewPdksRequirementsSwitch, {});
  expect(preview.projects[0]).toMatchObject({ skipReason: null, sourceVersion: { _id: original.versionId }, futureVersions: [{ _id: original.future, punchMode: "legacy" }] });
  const result = await f.t.mutation(internal.dataMigrations.switchProjectsToRequirements, { actorUserId: f.actorUserId });
  expect(result.updated).toEqual([{ projectId: f.projectId, ruleVersionId: original.future }]);
  const after = await f.t.run(async ctx => ({ versions: await ctx.db.query("pdksRuleVersions").collect(), targets: await ctx.db.query("pdksCheckpointSelections").collect() }));
  for (const version of original.versions) expect(after.versions.find(v => v._id === version._id)).toEqual(version._id === original.future
    ? { ...version, punchMode: "requirements", requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review", noPunch: "review" } : version);
  expect(after.targets.filter(target => target.ruleVersionId === original.future)).toEqual(original.targets.filter(target => target.ruleVersionId === original.future));
  const boundary = after.versions.find(v => v.effectiveFrom === "2026-11-18");
  expect(boundary).toMatchObject({ calculationMode: "firstLast", minPunchIntervalMinutes: 4, checkpointMode: "selected" });
  const fields = (rows: typeof after.targets) => rows.map(({ _id, _creationTime, ruleVersionId: _version, ...rest }) => rest);
  expect(fields(after.targets.filter(v => v.ruleVersionId === boundary?._id))).toEqual(fields(original.targets.filter(v => v.ruleVersionId === original.versionId)));
  const second = await f.t.mutation(internal.dataMigrations.switchProjectsToRequirements, { actorUserId: f.actorUserId });
  expect(second.created).toEqual([]);
  expect(second.updated).toEqual([]);
  expect(await f.t.run(async ctx => ({ versions: await ctx.db.query("pdksRuleVersions").collect(), targets: await ctx.db.query("pdksCheckpointSelections").collect() }))).toEqual(after);
  expect(await f.t.run(async ctx => (await loadPdksRulePolicy(ctx, f.projectId, "2026-12-01", "2026-12-01"))("2026-12-01").punchMode)).toBe("requirements");
});

it.each([false, true])("a future requirements version does not skip boundary creation (no earlier version: %s)", async noEarlierVersion => {
  const f = await fixture();
  if (noEarlierVersion) await f.t.run(ctx => ctx.db.delete(f.versionId));
  const future = await f.t.run(ctx => ctx.db.insert("pdksRuleVersions", { projectId: f.projectId, effectiveFrom: "2026-12-01", punchMode: "requirements", checkpointMode: "all", requireCheckIn: false, requireCheckOut: true, noPunch: "absent", missingRequiredPunch: "absent", createdAt: "future", createdBy: f.actorUserId }));
  const original = await f.t.run(ctx => ctx.db.get(future));
  expect((await f.t.query(internal.dataMigrations.previewPdksRequirementsSwitch, {})).projects[0]).toMatchObject({ skipReason: null, futureVersions: [{ _id: future }] });
  const result = await f.t.mutation(internal.dataMigrations.switchProjectsToRequirements, { actorUserId: f.actorUserId });
  expect(result.created).toHaveLength(1);
  expect(result.updated).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.get(future))).toEqual(original);
  expect(await f.t.run(async ctx => (await loadPdksRulePolicy(ctx, f.projectId, "2026-11-18", "2026-11-18"))("2026-11-18"))).toMatchObject({ punchMode: "requirements", checkpointMode: noEarlierVersion ? "all" : "selected" });
});

it.each(["requirements", "legacy"] as const)("normalizes future legacy even if boundary creation is skipped (%s)", async punchMode => {
  const f = await fixture();
  const sourceDate = punchMode === "legacy" ? "2026-11-18" : "2026-11-17";
  await f.t.run(ctx => ctx.db.patch(f.versionId, { effectiveFrom: sourceDate, punchMode }));
  const boundaryBefore = await f.t.run(ctx => ctx.db.get(f.versionId));
  const future = await f.t.run(ctx => ctx.db.insert("pdksRuleVersions", { projectId: f.projectId, effectiveFrom: "2026-12-01", punchMode: "legacy", checkpointMode: "all", createdAt: "", createdBy: f.actorUserId }));
  const result = await f.t.mutation(internal.dataMigrations.switchProjectsToRequirements, { actorUserId: f.actorUserId });
  expect(result.created).toEqual([]);
  expect(result.updated).toEqual([{ projectId: f.projectId, ruleVersionId: future }]);
  expect(result.skipped).toEqual([{ projectId: f.projectId, reason: punchMode === "legacy" ? "versionAtSwitchDate" : "alreadyRequirements" }]);
  expect(await f.t.run(ctx => ctx.db.get(f.versionId))).toEqual(boundaryBefore);
  expect(await f.t.run(ctx => ctx.db.get(future))).toMatchObject({ punchMode: "requirements", requireCheckIn: true, requireCheckOut: true, noPunch: "review", missingRequiredPunch: "review" });
});

it("paginates projects and rejects a missing actor without writes", async () => {
  const f = await fixture();
  await f.t.run(async ctx => { for (let i = 0; i < 11; i++) await ctx.db.insert("projects", { name: `Extra ${i}` }); });
  const first = await f.t.mutation(internal.dataMigrations.switchProjectsToRequirements, { actorUserId: f.actorUserId });
  expect(first.isDone).toBe(false);
  expect(first.created).toHaveLength(10);
  const second = await f.t.mutation(internal.dataMigrations.switchProjectsToRequirements, { actorUserId: f.actorUserId, cursor: first.continueCursor });
  expect(second.isDone).toBe(true);
  expect(second.created).toHaveLength(2);
  await f.t.run(ctx => ctx.db.delete(f.actorUserId));
  await expect(f.t.mutation(internal.dataMigrations.switchProjectsToRequirements, { actorUserId: f.actorUserId })).rejects.toThrow("kullanıcısı");
});
