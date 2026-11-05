/**
 * "Ayrıntılara devam et": kaydedilen kişi listeye düşünce açılır. Tekil sorgu ile liste aynı Convex
 * anlık görüntüsünden gelir; sorgu döndüğü hâlde kişi listede yoksa (silindi, listeye girmiyor)
 * beklemek yükleniyor ekranında sonsuza takılır.
 */
export function resolveContinuingEmployee<T extends { _id: string }>(
  employees: readonly T[],
  employeeId: string,
  lookup: unknown,
): T | "wait" | "missing" {
  const saved = employees.find((item) => item._id === employeeId);
  if (saved) return saved;
  return lookup === undefined ? "wait" : "missing";
}
