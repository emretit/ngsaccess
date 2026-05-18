"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import {
  gatewayApiCall,
  setWeekPlanOnDevice,
  setPlanTemplate,
  addCardToDevice,
  upsertPersonToDevice,
} from "../lib/hikGateway";
import { defaultRuleSchedule } from "../lib/hikSync";

export const dumpEndpoint = internalAction({
  args: {
    devIndex: v.string(),
    path: v.string(),
    method: v.union(v.literal("GET"), v.literal("POST"), v.literal("PUT")),
    body: v.optional(v.any()),
  },
  handler: async (_ctx, args) => {
    const result = await gatewayApiCall(
      args.path,
      args.method,
      args.body ?? null,
      args.devIndex,
    );
    return {
      status: result.status,
      raw: result.raw,
      data: result.data,
    };
  },
});

export const testWeekPlanPush = internalAction({
  args: {
    devIndex: v.string(),
    weekPlanNo: v.number(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const schedule = defaultRuleSchedule({
      startTime: args.startTime,
      endTime: args.endTime,
    });
    const wp = await setWeekPlanOnDevice(args.devIndex, args.weekPlanNo, schedule);
    if (!wp.ok) return { step: "weekPlan", error: wp.error };
    const tpl = await setPlanTemplate(args.devIndex, args.weekPlanNo, {
      weekPlanNo: args.weekPlanNo,
      templateName: `TestTpl${args.weekPlanNo}`,
    });
    if (!tpl.ok) return { step: "planTemplate", error: tpl.error };
    return { ok: true };
  },
});

export const testCardPush = internalAction({
  args: {
    devIndex: v.string(),
    employeeNo: v.string(),
    cardNo: v.string(),
  },
  handler: async (_ctx, args) => {
    const r = await addCardToDevice(args.devIndex, {
      employeeNo: args.employeeNo,
      cardNo: args.cardNo,
      cardType: "normalCard",
    });
    return r;
  },
});

export const upsertPersons = internalAction({
  args: {
    devIndex: v.string(),
    weekPlanNo: v.number(),
    doorCount: v.optional(v.number()),
    employees: v.array(
      v.object({ employeeNo: v.string(), name: v.string() }),
    ),
  },
  handler: async (_ctx, args) => {
    const results: Array<{ employeeNo: string; ok: boolean; error?: string }> = [];
    for (const emp of args.employees) {
      const r = await upsertPersonToDevice(args.devIndex, {
        employeeNo: emp.employeeNo,
        name: emp.name,
        planTemplateNo: args.weekPlanNo,
        doorCount: args.doorCount,
      });
      results.push({
        employeeNo: emp.employeeNo,
        ok: r.ok,
        ...(r.error ? { error: r.error } : {}),
      });
    }
    return results;
  },
});

export const testFullSync = internalAction({
  args: {
    devIndex: v.string(),
    weekPlanNo: v.number(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    employees: v.array(
      v.object({ employeeNo: v.string(), cardNo: v.string() }),
    ),
  },
  handler: async (_ctx, args) => {
    const schedule = defaultRuleSchedule({
      startTime: args.startTime,
      endTime: args.endTime,
    });
    const wp = await setWeekPlanOnDevice(args.devIndex, args.weekPlanNo, schedule);
    if (!wp.ok) return { step: "weekPlan", error: wp.error };
    const tpl = await setPlanTemplate(args.devIndex, args.weekPlanNo, {
      weekPlanNo: args.weekPlanNo,
      templateName: `Tpl${args.weekPlanNo}`,
    });
    if (!tpl.ok) return { step: "planTemplate", error: tpl.error };
    const cards: Array<{ employeeNo: string; ok: boolean; error?: string }> = [];
    for (const emp of args.employees) {
      const r = await addCardToDevice(args.devIndex, {
        employeeNo: emp.employeeNo,
        cardNo: emp.cardNo,
        cardType: "normalCard",
      });
      cards.push({
        employeeNo: emp.employeeNo,
        ok: r.ok,
        ...(r.error ? { error: r.error } : {}),
      });
    }
    return { ok: true, cards };
  },
});
