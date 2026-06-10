/**
 * Saf (ctx'siz, Convex-bağımsız) reconcile yardımcıları.
 *
 * Erişim kuralı düzenlenince (full-replace) eski/yeni üye veya cihaz listeleri arasındaki
 * farkı çıkarıp, hangi entity'lerin panelden revoke edilmesi gerektiğine karar vermek için
 * kullanılır. Burada DB/scheduler yok → birim testleri kolay (bkz. reconcileMath.test.ts).
 */

/** Eski ve yeni id listeleri arasındaki fark. Karşılaştırma değer eşitliğiyle (Set) yapılır. */
export function diffIds<T extends string>(
  oldIds: ReadonlyArray<T>,
  newIds: ReadonlyArray<T>,
): { removed: T[]; added: T[]; kept: T[] } {
  const oldSet = new Set<T>(oldIds);
  const newSet = new Set<T>(newIds);
  const removed: T[] = [];
  const kept: T[] = [];
  for (const id of oldSet) {
    if (newSet.has(id)) kept.push(id);
    else removed.push(id);
  }
  const added: T[] = [];
  for (const id of newSet) {
    if (!oldSet.has(id)) added.push(id);
  }
  return { removed, added, kept };
}

/**
 * Aday paneller arasından, entity'nin (çalışanın) ARTIK erişmediği panelleri döndürür:
 * `candidate − remaining`. Tekilleştirir. `deleteUser` yalnızca bu gerçek orphan'lara
 * uygulanmalı; hâlâ erişilen panellerde permission azaltma (re-sync) yapılır.
 */
export function orphanPanels<T extends string>(
  candidate: ReadonlyArray<T>,
  remaining: ReadonlyArray<T>,
): T[] {
  const remainingSet = new Set<T>(remaining);
  const out = new Set<T>();
  for (const id of candidate) {
    if (!remainingSet.has(id)) out.add(id);
  }
  return Array.from(out);
}

/**
 * Kuraldan cihaz(lar) çıkarılırken silinmesi gereken groupDoors satırlarını seçer:
 * kapısı (CANLI doors.deviceId) çıkarılan cihazlardan birine ait olan satırlar.
 *
 * `doorDeviceById` haritasında OLMAYAN kapı (doors kaydı silinmiş) ve `deviceId`'si
 * undefined olan kapı (panele bağlı değil) dokunulmadan bırakılır — reconcile'ın kapı
 * bacağı bunları zaten yetki saymaz; yanlış pozitif silme riskine girilmez.
 */
export function staleGroupDoorIds<
  GD extends string,
  D extends string,
  Dev extends string,
>(
  rows: ReadonlyArray<{ _id: GD; doorId: D }>,
  doorDeviceById: ReadonlyMap<D, Dev | undefined>,
  removedDeviceIds: ReadonlySet<Dev>,
): GD[] {
  const out: GD[] = [];
  for (const row of rows) {
    if (!doorDeviceById.has(row.doorId)) continue;
    const deviceId = doorDeviceById.get(row.doorId);
    if (deviceId !== undefined && removedDeviceIds.has(deviceId)) out.push(row._id);
  }
  return out;
}
