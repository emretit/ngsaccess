import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const setupCardAndDevice = internalMutation({
  args: {
    cardNo: v.string(),
    deviceSerial: v.string(),
    employeeFirstName: v.optional(v.string()),
    employeeLastName: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    ruleName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    const project = await ctx.db.query("projects").first();
    if (!project) {
      throw new Error("Hiç project yok — önce bir proje oluşturulmalı.");
    }
    const projectId = project._id;

    let device = await ctx.db
      .query("devices")
      .withIndex("by_device_serial", (q) =>
        q.eq("deviceSerial", args.deviceSerial)
      )
      .first();
    let deviceCreated = false;
    if (!device) {
      const deviceId = await ctx.db.insert("devices", {
        name: args.deviceName ?? `ESP32 Reader (${args.deviceSerial.slice(-6)})`,
        projectId,
        deviceType: "card-reader",
        deviceSerial: args.deviceSerial,
        accessDirection: "both",
        isActive: true,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      device = await ctx.db.get(deviceId);
      deviceCreated = true;
    }

    let employee = await ctx.db
      .query("employees")
      .withIndex("by_card", (q) => q.eq("cardNumber", args.cardNo))
      .first();
    let employeeCreated = false;
    if (!employee) {
      const empId = await ctx.db.insert("employees", {
        projectId,
        firstName: args.employeeFirstName ?? "Test",
        lastName: args.employeeLastName ?? "Çalışan",
        email: `test-${args.cardNo}@example.local`,
        tcNo: "00000000000",
        cardNumber: args.cardNo,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      employee = await ctx.db.get(empId);
      employeeCreated = true;
    } else if (!employee.isActive) {
      await ctx.db.patch(employee._id, { isActive: true, updatedAt: now });
    }

    const ruleNameFinal = args.ruleName ?? "Test Erişim Kuralı (24/7)";
    const allRules = await ctx.db
      .query("accessRules")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    let rule = allRules.find((r) => r.name === ruleNameFinal) ?? null;
    let ruleCreated = false;
    if (!rule) {
      const ruleId = await ctx.db.insert("accessRules", {
        name: ruleNameFinal,
        projectId,
        targetType: "employee",
        description: "Test amaçlı: 7/24 tüm cihazlara erişim",
        startTime: "00:00",
        endTime: "23:59",
        days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        priority: 100,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      rule = await ctx.db.get(ruleId);
      ruleCreated = true;
    } else if (!rule.isActive) {
      await ctx.db.patch(rule._id, { isActive: true, updatedAt: now });
    }

    if (!device || !employee || !rule) {
      throw new Error("Beklenmedik: device/employee/rule oluşturulamadı.");
    }

    const memberExisting = await ctx.db
      .query("groupMembers")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee!._id))
      .collect();
    let memberCreated = false;
    if (!memberExisting.some((m) => m.groupId === rule!._id)) {
      await ctx.db.insert("groupMembers", {
        groupId: rule._id,
        employeeId: employee._id,
        projectId,
        createdAt: now,
      });
      memberCreated = true;
    }

    const groupDevExisting = await ctx.db
      .query("groupDevices")
      .withIndex("by_device", (q) => q.eq("deviceId", device!._id))
      .collect();
    let groupDeviceCreated = false;
    if (!groupDevExisting.some((gd) => gd.groupId === rule!._id)) {
      await ctx.db.insert("groupDevices", {
        groupId: rule._id,
        deviceId: device._id,
        projectId,
        createdAt: now,
      });
      groupDeviceCreated = true;
    }

    return {
      projectId,
      deviceId: device._id,
      deviceCreated,
      employeeId: employee._id,
      employeeCreated,
      ruleId: rule._id,
      ruleCreated,
      memberCreated,
      groupDeviceCreated,
    };
  },
});
