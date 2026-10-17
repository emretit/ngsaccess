import { z } from "zod";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
export const assignmentSchema = z.object({ employeeId: z.string().min(1, "Bir kişi seçin"), expectedCurrentCard: z.string().nullable(), replace: z.boolean() });
export type Assignment = z.infer<typeof assignmentSchema>;
export function assignmentValidation(values: Assignment, selected: { cardNumber: string; isActive?: boolean } | undefined, cardNo: string) {
  if (!assignmentSchema.safeParse(values).success || !selected) return "Bir kişi seçin";
  if (selected.isActive === false) return "Pasif kişiye kart atanamaz";
  if (selected.cardNumber !== values.expectedCurrentCard) return "Kişinin kartı değişti. Güncel kartı kontrol edip yeniden onaylayın";
  if (values.expectedCurrentCard && values.expectedCurrentCard !== cardNo && !values.replace) return "Mevcut kartı değiştireceğinizi onaylayın";
  return null;
}
const successMessages = {
  pending: "Kart kişiye atandı; cihaz uygulama durumu bekleniyor",
  notRequested: "Kart zaten bu kişiye atanmış; cihaz durumu bu işlemle doğrulanmadı",
  noTargets: "Kart kişiye atandı; bu kişi için kayıtlı cihaz yok",
};
export const assignmentSuccess = (result: Pick<FunctionReturnType<typeof api.cardReadings.assignCardFromReading>, "syncStatus">) => successMessages[result.syncStatus];
