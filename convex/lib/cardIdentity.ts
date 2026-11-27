import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const NUMERIC_CARD_CONFLICT = "Bu kart numarası (baştaki sıfırlar hariç) başka bir kayıtta kullanılıyor.";

/** Decimal card identity; text cards keep their existing exact-match semantics. */
export function cardNumericKey(card: string): string | null {
  return /^[0-9]+$/.test(card) ? card.replace(/^0+/, "") || "0" : null;
}

/** Physical cards and imported Hik person IDs share the device identity namespace. */
export async function findDuplicateCard(
  ctx: Pick<QueryCtx, "db">,
  card: string,
  excludeId?: Id<"employees">,
): Promise<Doc<"employees"> | null> {
  const variants = new Set([card]);
  const key = cardNumericKey(card);
  if (key !== null) {
    for (let length = key.length; length <= 20; length++) variants.add(key.padStart(length, "0"));
  }
  for (const variant of variants) {
    const matches = await ctx.db.query("employees").withIndex("by_card", q => q.eq("cardNumber", variant)).take(2);
    const personMatches = await ctx.db.query("employees").withIndex("by_hikEmployeeNo", q => q.eq("hikEmployeeNo", variant)).take(2);
    for (const employee of [...matches, ...personMatches]) {
      if (employee._id !== excludeId) return employee;
    }
  }
  return null;
}

export function cardConflictMessage(card: string, duplicate: Pick<Doc<"employees">, "cardNumber" | "hikEmployeeNo">, exactMessage: string): string {
  return duplicate.cardNumber === card || duplicate.hikEmployeeNo === card ? exactMessage : NUMERIC_CARD_CONFLICT;
}
