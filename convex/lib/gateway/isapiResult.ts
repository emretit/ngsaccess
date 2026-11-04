/** Pure validation shared by event reads and destructive/device commands. */
export function isapiRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

type IsapiResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

export function validateIsapiResult(
  result: { status: number; data: unknown },
  expectedField?: string,
): IsapiResult {
  if (result.status !== 200) return { ok: false, error: `Cihaz yanıtı alınamadı (HTTP ${result.status})` };
  const data = isapiRecord(result.data);
  if (!data) return { ok: false, error: "Cihaz yanıtı beklenen biçimde değil" };
  let acknowledged = false;
  const inspect = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.every(inspect);
    const record = isapiRecord(value);
    if (!record) return true;
    if (record.statusCode !== undefined) {
      if (record.statusCode !== 1 && record.statusCode !== "1") return false;
      acknowledged = true;
    }
    if (record.subStatusCode !== undefined) {
      if (typeof record.subStatusCode !== "string" || record.subStatusCode.toLowerCase() !== "ok") return false;
      acknowledged = true;
    }
    if (record.statusString === "OK") acknowledged = true;
    return Object.values(record).every(inspect);
  };
  if (!inspect(data)) return { ok: false, error: "Cihaz işlemi reddetti (ISAPI durum hatası)" };
  if (expectedField ? !isapiRecord(data[expectedField]) : !acknowledged) {
    return { ok: false, error: "Cihaz yanıtında beklenen sonuç bulunamadı" };
  }
  return { ok: true, data };
}
