
import { TurkishNlpParser, type NaturalLanguageQuery } from "./parsers/turkishNlpParser";
import { MessageData } from "../types";
import type { FetchCardReadingsFn } from "./database/cardReadingsService";
import { getDateRange } from "../../../../lib/pdksDateRanges";

export type NlFetchers = {
  fetchCardReadings: FetchCardReadingsFn;
};

function timeRangeToDates(tr: NaturalLanguageQuery["timeRange"]): { date?: string; startDate?: string; endDate?: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = fmt(now);

  switch (tr.type) {
    case "today":
      return { date: today };
    case "yesterday": {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return { date: fmt(d) };
    }
    case "this_week": {
      const { from } = getDateRange("this-week", now);
      return { startDate: fmt(from), endDate: today };
    }
    case "last_week": {
      const { from, to } = getDateRange("last-week", now);
      return { startDate: fmt(from), endDate: fmt(to) };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: fmt(start), endDate: today };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: fmt(start), endDate: fmt(end) };
    }
    case "custom":
      return { startDate: tr.startDate, endDate: tr.endDate ?? tr.startDate };
    default:
      return { date: today };
  }
}

export class NaturalLanguageService {
  static async processQuery(
    userQuery: string,
    fetchers?: NlFetchers,
  ): Promise<{
    content: string;
    data?: MessageData[];
    source: string;
  }> {
    try {
      const nlQuery = TurkishNlpParser.parse(userQuery);
      const dateParams = timeRangeToDates(nlQuery.timeRange);

      let results: MessageData[] = [];

      if (fetchers) {
        results = await fetchers.fetchCardReadings({
          department: nlQuery.filters.department ?? null,
          date: dateParams.date ?? null,
          startDate: dateParams.startDate ?? null,
          endDate: dateParams.endDate ?? null,
        });
      }

      // Client-side filtering — late/absent/employee
      if (nlQuery.filters.employee) {
        const emp = nlQuery.filters.employee.toLowerCase();
        results = results.filter(r => r.name.toLowerCase().includes(emp));
      }

      if (nlQuery.filters.absent) {
        results = results.filter(r => !r.check_in || r.check_in === "-");
      }

      const formattedData = results;
      const responseMessage = this.generateResponse(nlQuery, formattedData);

      return {
        content: responseMessage,
        data: formattedData,
        source: "natural_language",
      };
    } catch (error) {
      console.error("Doğal dil işleme hatası:", error);
      return {
        content: `Sorgunuzu işlerken bir hata oluştu: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
        source: "error",
      };
    }
  }

  private static generateResponse(nlQuery: NaturalLanguageQuery, data: MessageData[]): string {
    const count = data.length;
    const timeText = this.getTimeRangeText(nlQuery.timeRange);

    switch (nlQuery.intent) {
      case "count":
        if (nlQuery.filters.department) {
          return `${timeText} ${nlQuery.filters.department} departmanında ${count} çalışan bulundu.`;
        }
        return `${timeText} toplam ${count} çalışan bulundu.`;
      case "late":
        return count > 0
          ? `${timeText} ${count} çalışan geç kalmış. Aşağıda detaylar:`
          : `${timeText} geç kalan çalışan bulunamadı.`;
      case "absent":
        return count > 0
          ? `${timeText} ${count} çalışan devamsızlık yapmış:`
          : `${timeText} devamsızlık yapan çalışan bulunamadı.`;
      case "present":
        return count > 0
          ? `${timeText} ${count} çalışan işe gelmiş:`
          : `${timeText} giriş kaydı bulunamadı.`;
      case "list":
      default:
        if (count === 0) {
          return `${timeText} kayıt bulunamadı.`;
        }
        if (nlQuery.filters.employee) {
          return `${nlQuery.filters.employee} için ${timeText} kayıtlar (${count} sonuç):`;
        } else if (nlQuery.filters.department) {
          return `${nlQuery.filters.department} departmanı için ${timeText} kayıtlar (${count} sonuç):`;
        }
        return `${timeText} PDKS kayıtları (${count} sonuç):`;
    }
  }

  private static getTimeRangeText(timeRange: NaturalLanguageQuery["timeRange"]): string {
    switch (timeRange.type) {
      case "today": return "Bugün";
      case "yesterday": return "Dün";
      case "this_week": return "Bu hafta";
      case "last_week": return "Geçen hafta";
      case "this_month": return "Bu ay";
      case "last_month": return "Geçen ay";
      case "custom":
        if (timeRange.startDate) {
          return `${new Date(timeRange.startDate).toLocaleDateString("tr-TR")} tarihinde`;
        }
        return "";
      default: return "";
    }
  }

  static getSampleQueries(): string[] {
    return [
      "Bugün kimler geç kaldı?",
      "Bu hafta IT departmanında kimler vardı?",
      "Bu ay en çok geç kalan kişi kim?",
      "Dün kaç kişi işe geldi?",
      "Bu ay en çok geç kalan 10 kişi",
      "Geçen hafta devamsızlık yapanlar",
      "Bugün hangi departmanlarda kimler var?",
      "Bu hafta gece vardiyasında kimler vardı?",
    ];
  }
}
