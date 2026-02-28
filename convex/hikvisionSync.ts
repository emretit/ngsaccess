import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

/**
 * Çalışanın erişim grupları üzerinden bağlı olduğu cihazları ve kuralları getirir.
 */
export const getEmployeeWithDevices = internalQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) return null;

    // Employee'nin dahil olduğu grupları bul
    const groupMemberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .collect();

    const deviceRules: {
      device: {
        _id: string;
        deviceIp: string;
        deviceUsername: string;
        devicePassword: string;
      };
      rule: {
        _id: string;
        hikWeekPlanNo?: number;
      };
    }[] = [];

    for (const gm of groupMemberships) {
      // Erişim kuralını al
      const rule = await ctx.db.get(gm.groupId);
      if (!rule || !rule.isActive) continue;

      // Bu gruptaki cihazları bul
      const groupDevices = await ctx.db
        .query("groupDevices")
        .withIndex("by_group", (q) => q.eq("groupId", gm.groupId))
        .collect();

      for (const gd of groupDevices) {
        const device = await ctx.db.get(gd.deviceId);
        if (!device || !device.deviceIp || !device.isActive) continue;

        deviceRules.push({
          device: {
            _id: device._id,
            deviceIp: device.deviceIp,
            deviceUsername: device.deviceUsername ?? "admin",
            devicePassword: device.devicePassword ?? "",
          },
          rule: {
            _id: rule._id,
            hikWeekPlanNo: rule.hikWeekPlanNo,
          },
        });
      }
    }

    return {
      employee: {
        _id: employee._id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        cardNumber: employee.cardNumber,
      },
      deviceRules,
    };
  },
});

/**
 * Erişim kuralının bağlı olduğu cihazları ve çalışanları getirir.
 */
export const getAccessRuleWithDevices = internalQuery({
  args: { accessRuleId: v.id("accessRules") },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.accessRuleId);
    if (!rule) return null;

    // Gruptaki cihazlar
    const groupDevices = await ctx.db
      .query("groupDevices")
      .withIndex("by_group", (q) => q.eq("groupId", args.accessRuleId))
      .collect();

    const devices: {
      _id: string;
      deviceIp: string;
      deviceUsername: string;
      devicePassword: string;
    }[] = [];

    for (const gd of groupDevices) {
      const device = await ctx.db.get(gd.deviceId);
      if (!device || !device.deviceIp || !device.isActive) continue;
      devices.push({
        _id: device._id,
        deviceIp: device.deviceIp,
        deviceUsername: device.deviceUsername ?? "admin",
        devicePassword: device.devicePassword ?? "",
      });
    }

    // Gruptaki çalışanlar
    const groupMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.accessRuleId))
      .collect();

    const employees: {
      _id: string;
      firstName: string;
      lastName: string;
      cardNumber: string;
    }[] = [];

    for (const gm of groupMembers) {
      const emp = await ctx.db.get(gm.employeeId);
      if (!emp || !emp.isActive) continue;
      employees.push({
        _id: emp._id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        cardNumber: emp.cardNumber,
      });
    }

    return {
      rule: {
        _id: rule._id,
        name: rule.name,
        startTime: rule.startTime,
        endTime: rule.endTime,
        days: rule.days,
        hikWeekPlanNo: rule.hikWeekPlanNo,
      },
      devices,
      employees,
    };
  },
});

/**
 * Erişim kuralına hikWeekPlanNo atar.
 */
export const assignWeekPlanNo = internalMutation({
  args: {
    accessRuleId: v.id("accessRules"),
    weekPlanNo: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accessRuleId, { hikWeekPlanNo: args.weekPlanNo });
  },
});

/**
 * Mevcut en yüksek hikWeekPlanNo değerini bulur.
 */
export const getMaxWeekPlanNo = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db.query("accessRules").collect();
    let max = 1;
    for (const r of rules) {
      if (r.hikWeekPlanNo && r.hikWeekPlanNo > max) {
        max = r.hikWeekPlanNo;
      }
    }
    return max;
  },
});
