/** Bağımlılığı bulunan mantıksal bölge silinemez. */
export function zoneDeleteBlocker(hasDoor: boolean, hasDevice: boolean): string | null {
  if (hasDoor && hasDevice) {
    return "Bu bölgede kapı ve cihaz var. Önce kapıları ve cihazları başka bölgeye taşıyın veya silin.";
  }
  if (hasDoor) return "Bu bölgede kapı var. Önce kapıları başka bölgeye taşıyın veya silin.";
  if (hasDevice) return "Bu bölgede cihaz var. Önce cihazları başka bölgeye taşıyın veya silin.";
  return null;
}
