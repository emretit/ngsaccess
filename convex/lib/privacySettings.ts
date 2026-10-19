import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { toPatch } from "./nullablePatch";

export type PrivacySettings = {
  biometricEnabled: boolean;
  biometricReason: string | null;
  cardReadingRetentionDays: number | null;
  aiMaskNames: boolean;
};

// Satır yokken geçerli değerler. Canlı sistemi bozmamak için biyometri AÇIK
// (grandfather); yeni projeler satırı açıkça `biometricEnabled: false` ile oluşturur.
export const DEFAULT_PRIVACY: PrivacySettings = {
  biometricEnabled: true,
  biometricReason: null,
  cardReadingRetentionDays: null,
  aiMaskNames: true,
};

// Okumalar puantaj, bordro ve raporların hesap kaynağıdır.
// Ürün politikası: otomatik silme için 5–10 yıl; yasal süre danışmana doğrulatılır.
export const MIN_CARD_READING_RETENTION_DAYS = 1825;
export const MAX_CARD_READING_RETENTION_DAYS = 3650;

export function toPrivacySettings(row: Doc<"projectPrivacySettings"> | null): PrivacySettings {
  if (!row) return DEFAULT_PRIVACY;
  return {
    biometricEnabled: row.biometricEnabled ?? DEFAULT_PRIVACY.biometricEnabled,
    biometricReason: row.biometricReason ?? null,
    cardReadingRetentionDays: row.cardReadingRetentionDays ?? null,
    aiMaskNames: row.aiMaskNames ?? DEFAULT_PRIVACY.aiMaskNames,
  };
}

export async function getPrivacyRow(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projectPrivacySettings"> | null> {
  return await ctx.db
    .query("projectPrivacySettings")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .first();
}

export async function getPrivacySettings(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
): Promise<PrivacySettings> {
  return toPrivacySettings(await getPrivacyRow(ctx, projectId));
}

// projectId'siz kayıt (eski veri) kapsamsızdır; biyometri kapısı için eski davranış.
export async function isBiometricEnabled(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects"> | undefined,
): Promise<boolean> {
  if (!projectId) return DEFAULT_PRIVACY.biometricEnabled;
  return (await getPrivacySettings(ctx, projectId)).biometricEnabled;
}

export type PrivacyPatch = {
  biometricEnabled?: boolean;
  biometricReason?: string | null;
  biometricChangedAt?: string;
  biometricChangedBy?: Id<"users">;
  cardReadingRetentionDays?: number | null;
  aiMaskNames?: boolean;
};

// Yalnız verilen alanları yazar; satır yoksa oluşturur. Kısmi patch: undefined alanlar
// dokunulmaz (iki worker farklı alanları yazar, birbirini ezmemeli); null alanı temizler
// (ör. cardReadingRetentionDays: null = süresiz).
export async function upsertPrivacySettings(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  patch: PrivacyPatch,
): Promise<void> {
  const defined = toPatch(patch);
  const updatedAt = new Date().toISOString();
  const row = await getPrivacyRow(ctx, projectId);
  if (row) {
    await ctx.db.patch(row._id, { ...defined, updatedAt });
    return;
  }
  await ctx.db.insert("projectPrivacySettings", { projectId, ...defined, updatedAt });
}
