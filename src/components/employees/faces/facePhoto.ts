export const MAX_FACE_BYTES = 200 * 1024;

export function capturedFaceBytes(result: { ok: boolean; faceDataBase64?: string; faceURL?: string; error?: string }): ArrayBuffer {
  if (!result.ok) throw new Error(result.error ?? "Cihazdan yüz alınamadı.");
  if (!result.faceDataBase64) throw new Error("Cihaz fotoğraf verisi döndürmedi. JPEG fotoğraf yükleyerek devam edin.");
  const encoded = result.faceDataBase64.replace(/^data:image\/jpeg;base64,/, "");
  if (encoded.length > Math.ceil(MAX_FACE_BYTES / 3) * 4) throw new Error("Yüz fotoğrafı en fazla 200 KB olmalıdır.");
  let decoded: string;
  try { decoded = atob(encoded); } catch { throw new Error("Cihaz geçerli fotoğraf verisi döndürmedi."); }
  return Uint8Array.from(decoded, char => char.charCodeAt(0)).buffer;
}

export function faceDeliveryLabel(device: { status: string; operation: string | null }) {
  if (device.status === "pending") return "Sırada";
  if (device.status === "processing") return "İşleniyor";
  if (device.status === "failed") return device.operation === "deleteFace" ? "Silme başarısız" : "Gönderim başarısız";
  if (device.status === "done") return device.operation === "deleteFace" ? "Silme teslim edildi" : "Yüz teslim edildi";
  return "Cihazdaki kayıt doğrulanmadı";
}
