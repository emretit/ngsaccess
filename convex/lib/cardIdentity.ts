import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const NUMERIC_CARD_CONFLICT = "Bu kart numarası (baştaki sıfırlar hariç) başka bir kayıtta kullanılıyor.";

/** Decimal card identity; text cards keep their existing exact-match semantics. */
export function cardNumericKey(card: string): string | null {
  return /^[0-9]+$/.test(card) ? card.replace(/^0+/, "") || "0" : null;
}

/** Existing by_card index only: exact card, canonical decimal, then padded forms up to 20 digits. */
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
    const matches = ctx.db.query("employees").withIndex("by_card", q => q.eq("cardNumber", variant));
    for await (const employee of matches) {
      if (employee._id !== excludeId) return employee;
    }
  }
  return null;
}

export function cardConflictMessage(card: string, duplicate: Pick<Doc<"employees">, "cardNumber">, exactMessage: string): string {
  return duplicate.cardNumber === card ? exactMessage : NUMERIC_CARD_CONFLICT;
}
