import { MessageData, QueryParams } from "../../types";

export async function fetchCardReadings(_params: QueryParams): Promise<MessageData[]> {
  return [];
}

export async function fetchDatabaseContext(): Promise<string> {
  return "Veritabanı bağlantısı Convex'e geçirildi. AI sorguları için lütfen güncellenmiş servisi kullanın.";
}
