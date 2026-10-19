"use node";

import { filterPdksReadings } from "../lib/pdksSource";
import { v } from "convex/values";
import type { CardReadingListPage as ReadingPage } from "../cardReadings";
import { api, internal } from "../_generated/api";
import { authedAction } from "../lib/customFunctions";


/** AI sohbeti için seçili projeden sınırlı, cursor ile ilerleyen örneklem. */
export const getCardReadings = authedAction({
  args: {
    projectId: v.id("projects"),
    department: v.optional(v.string()),
    date: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    hasMore: boolean;
    scopeNote: string;
    readings: { name: string; check_in: string; check_out: string | null; department: string; device: string; location: string }[];
  }> => {
    const loaded: ReadingPage["page"] = [];
    let cursor: string | null = null;
    let isDone = false;
    for (let page = 0; page < 5 && !isDone && loaded.length < 500; page++) {
      const result: ReadingPage = await ctx.runQuery(api.cardReadings.list, {
        projectId: args.projectId,
        startDate: args.startDate ?? args.date,
        endDate: args.endDate ?? args.startDate ?? args.date,
        paginationOpts: { cursor, numItems: Math.min(100, 500 - loaded.length) },
      });
      loaded.push(...filterPdksReadings(result.page, args.projectId));
      cursor = result.continueCursor;
      isDone = result.isDone;
    }
    const department = args.department?.toLocaleLowerCase("tr-TR");
    const readings = department ? loaded.filter(r => r.employees?.departments?.name.toLocaleLowerCase("tr-TR").includes(department)) : loaded;
    const scopeNote = isDone
      ? `Seçili proje ve tarih kapsamında ${loaded.length} kayıt yüklendi.`
      : `Seçili proje ve tarih kapsamında ilk ${loaded.length} kayıt incelendi, devamı var; toplam bilinmiyor. Departman eşleşmesi yalnız yüklenen kayıtlarda arandı.`;
    return {
      hasMore: !isDone,
      scopeNote,
      readings: readings.map(r => ({
        name: r.employeeName ?? "Bilinmiyor",
        check_in: new Date(r.accessTime).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
        check_out: null as string | null,
        department: r.employees?.departments?.name ?? "Belirtilmemiş",
        device: r.devices?.name ?? "-",
        location: r.devices?.name ?? "-",
      })),
    };
  },
});

/** Toplam sayım değildir: seçili projenin son kayıtlarından bağlam. */
export const getDatabaseContext = authedAction({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<string> => {
    return await ctx.runQuery(internal.privacyRetention.getAssistantContext, { projectId: args.projectId });
  },
});
