import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { resolveRuleDeviceTargets } from "./lib/peopleHikSnapshot";

const READ_LIMIT = 8000;

/** A partial roster is never a deletion authority. Limit/lookup failures throw;
 * the action converts them to expected_unavailable without touching the device. */
export const getExpectedRoster = internalQuery({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const device = await ctx.db.get(deviceId);
    if (!device || device.brand !== "hikvision" || device.hikTransport !== "gateway" || !device.hikDevIndex) {
      return { device, employeeNos: null, skippedReason: "unsupported_device" };
    }
    if (!device.projectId || !device.isActive) {
      return { device, employeeNos: null, skippedReason: "device_scope_unavailable" };
    }
    let remaining = READ_LIMIT;
    const bounded = async <T>(query: { take: (n: number) => Promise<T[]> }) => {
      const rows = await query.take(remaining + 1);
      remaining -= rows.length;
      if (remaining < 0) throw new Error("Hik roster read limit exceeded");
      return rows;
    };
    const employeeNos = new Set<string>();
    const rules = await bounded(ctx.db.query("accessRules").withIndex("by_project_active", q =>
      q.eq("projectId", device.projectId).eq("isActive", true)));
    const seen = new Set<string>();
    for (const rule of rules) {
      const targets = await resolveRuleDeviceTargets(ctx, rule);
      if (!targets.some(target => target.device._id === deviceId)) continue;
      const members = await bounded(ctx.db.query("groupMembers").withIndex("by_project_group", q =>
        q.eq("projectId", device.projectId).eq("groupId", rule._id)));
      for (const member of members) {
        if (seen.has(member.employeeId)) continue;
        seen.add(member.employeeId);
        const employee = await ctx.db.get(member.employeeId);
        // Visitors are employees too (visitors.create -> groupMembers -> Hik sync).
        // Retain inactive/future credentials conservatively; normal sync owns revocation.
        if (employee?.projectId === device.projectId) employeeNos.add(employee.cardNumber);
      }
    }
    // Enrollment can outlive rule membership, or be in flight during registration.
    const enrollments = await bounded(ctx.db.query("deviceFingerprintEnrollments")
      .withIndex("by_device", q => q.eq("deviceId", deviceId)));
    for (const enrollment of enrollments) {
      if (enrollment.projectId !== device.projectId) continue;
      const employee = await ctx.db.get(enrollment.employeeId);
      if (employee?.projectId !== device.projectId || !employee) continue;
      employeeNos.add(employee.cardNumber);
      employeeNos.add(employee.cardNumber.trim());
      if (enrollment.enrolledEmployeeNo) employeeNos.add(enrollment.enrolledEmployeeNo);
      if (enrollment.deletionEmployeeNo) employeeNos.add(enrollment.deletionEmployeeNo);
    }
    // Preserve current-project additions pending/processing or retryable, including explicit
    // person/biometric identities from callers outside the rule-based writer.
    for (const status of ["pending", "processing", "failed"] as const) {
      const operations = await bounded(ctx.db.query("hikPendingOperations")
        .withIndex("by_device_status", q => q.eq("deviceId", deviceId).eq("status", status)));
      for (const operation of operations) {
        if (operation.projectId !== device.projectId || !["addPerson", "updatePerson", "addCard", "addFace", "addFingerprint"].includes(operation.operation)) continue;
        const payload: unknown = operation.payload;
        if (typeof payload !== "object" || payload === null) continue;
        if ("employeeId" in payload && typeof payload.employeeId === "string") {
          const employeeId = ctx.db.normalizeId("employees", payload.employeeId);
          const employee = employeeId ? await ctx.db.get(employeeId) : null;
          if (employee?.projectId === device.projectId) employeeNos.add(employee.cardNumber);
        }
        if ("employeeNo" in payload && typeof payload.employeeNo === "string") employeeNos.add(payload.employeeNo);
        if ("cardNumber" in payload && typeof payload.cardNumber === "string") employeeNos.add(payload.cardNumber);
      }
    }
    if (employeeNos.size > READ_LIMIT) throw new Error("Hik roster identity limit exceeded");
    return { device, employeeNos: [...employeeNos], skippedReason: null };
  },
});
