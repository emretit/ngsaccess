/**
 * accessGraph.resolvePanelAuthorizedCards'ın saf çekirdeği — DB bağımsız.
 *
 * Bir paneli hedefleyen kural id'leri (cihaz ∪ kapı bağı) çözüldükten ve her kuralın
 * üyeleri/kartları DB'den toplandıktan SONRA, yetkili kart kümesini hesaplar:
 * yalnız AKTİF kuralların üyelerinin (normalize edilmiş, boş olmayan) kartları.
 *
 * Generic `<R, E>`: çağıran `Id<"accessRules">` / `Id<"employees">` geçer, testler düz
 * string geçer; cast gerekmez. accessGraph.ts hem canlı wrapper hem read-only dry-run
 * ikizi (debugIde.panelRosterDiff) için tek kaynak olarak bunu kullanır.
 */
export function computeAuthorizedCards<R extends string, E extends string>(params: {
  /** Paneli hedefleyen tüm kural id'leri (cihaz ∪ kapı bağı). */
  ruleIds: Iterable<R>;
  /** isActive !== false olan kural id'leri (pasif kurallar üye katmaz). */
  activeRuleIds: ReadonlySet<R>;
  /** ruleId → üye employeeId listesi. */
  membersByRule: ReadonlyMap<R, ReadonlyArray<E>>;
  /** employeeId → ham kart numarası (normalizeCard'dan geçirilir). */
  cardByEmployee: ReadonlyMap<E, unknown>;
  /** Ham kartı normalize eder; null dönerse kart eklenmez. */
  normalizeCard: (card: unknown) => string | null;
}): Set<string> {
  const authorized = new Set<string>();
  for (const ruleId of params.ruleIds) {
    if (!params.activeRuleIds.has(ruleId)) continue;
    const members = params.membersByRule.get(ruleId) ?? [];
    for (const employeeId of members) {
      const card = params.normalizeCard(params.cardByEmployee.get(employeeId));
      if (card) authorized.add(card);
    }
  }
  return authorized;
}
