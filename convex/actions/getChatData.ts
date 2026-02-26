"use node";

import { v } from "convex/values";
import { api } from "../_generated/api";
import { authedAction } from "../lib/customFunctions";

type EnrichedReading = {
  employeeName?: string;
  accessTime: string;
  accessStatus?: string;
  device_name?: string;
  employees?: { departments?: { name?: string } };
};

/**
 * AI chat için kart okuma verilerini getirir.
 * Auth + project scope ile güvenli.
 */
export const getCardReadings = authedAction({
  args: {
    department: v.optional(v.string()),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runQuery(api.cardReadings.list, {
      dateFilter: args.date,
      pageSize: 100,
      page: 1,
    });

    let readings = result.readings as EnrichedReading[];

    if (args.department) {
      const deptLower = args.department.toLowerCase();
      readings = readings.filter(
        (r) =>
          r.employees?.departments?.name?.toLowerCase().includes(deptLower)
      );
    }

    return readings.map((r) => ({
      name: r.employeeName ?? "Bilinmiyor",
      check_in: new Date(r.accessTime).toLocaleString("tr-TR"),
      check_out: null as string | null,
      department: r.employees?.departments?.name ?? "Belirtilmemiş",
      device: r.device_name ?? "-",
      location: r.device_name ?? "-",
    }));
  },
});

/**
 * AI chat için veritabanı özet bağlamı döner.
 * Auth ile güvenli.
 */
export const getDatabaseContext = authedAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    const result = await ctx.runQuery(api.cardReadings.list, {
      pageSize: 20,
      page: 1,
    }) as { readings: EnrichedReading[]; totalCount: number };

    const sample = result.readings.slice(0, 5).map((r: EnrichedReading) => ({
      employee: r.employeeName,
      time: r.accessTime,
      status: r.accessStatus,
    }));

    return `Convex veritabanı: ${result.totalCount} toplam kart okuma kaydı. Son kayıtlar: ${JSON.stringify(sample)}. Sorgular için department ve date filtreleri kullanılabilir.`;
  },
});
