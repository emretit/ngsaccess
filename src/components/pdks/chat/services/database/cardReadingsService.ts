import { MessageData, QueryParams } from "../../types";

export type FetchCardReadingsFn = (params: QueryParams) => Promise<MessageData[]>;
export type FetchDatabaseContextFn = () => Promise<string>;

export async function fetchCardReadings(
  params: QueryParams,
  fetcher?: FetchCardReadingsFn
): Promise<MessageData[]> {
  if (!fetcher) return [];
  try {
    return await fetcher(params);
  } catch (error) {
    console.error("fetchCardReadings error:", error);
    return [];
  }
}

export async function fetchDatabaseContext(
  fetcher?: FetchDatabaseContextFn
): Promise<string> {
  if (!fetcher) {
    return "Convex veritabanı bağlantısı mevcut değil. AI sorguları sınırlı çalışacaktır.";
  }
  try {
    return await fetcher();
  } catch (error) {
    console.error("fetchDatabaseContext error:", error);
    return "Convex veritabanına bağlanılamadı.";
  }
}
