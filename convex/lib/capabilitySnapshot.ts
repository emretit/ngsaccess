/**
 * devices.hikCapabilitiesSnapshot içindeki tek bir probe sonucunu okur.
 * Tarama yoksa ya da bozuksa null döner: bilinmiyor, örtük ret değil.
 * gateway/capabilities.ts "use node" olduğundan bu okuyucu node'suz ayrı dosyada.
 */
export function snapshotProbeSupported(raw: string | undefined, key: string): boolean | null {
  if (!raw) return null;
  try {
    const snapshot: unknown = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== "object" || !("probes" in snapshot) || !Array.isArray(snapshot.probes)) return null;
    for (const probe of snapshot.probes as unknown[]) {
      if (probe && typeof probe === "object" && "key" in probe && probe.key === key && "supported" in probe && typeof probe.supported === "boolean") return probe.supported;
    }
  } catch { /* bozuk JSON = bilinmiyor */ }
  return null;
}
