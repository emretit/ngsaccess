"use node";

import {
  gatewayApiCall,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_POLL_MAX_INTERVAL_MS,
} from "./core";

/**
 * Okuyucudan canlı kart okutma işlemi başlatır ve tamamlanana kadar polling yapar.
 * GET /ISAPI/AccessControl/CaptureCardInfo
 *
 * captureFaceOnDevice poll desenini izler:
 *   - Önce GET yap, ardından (devam ediyorsa) sleep — ilk poll'dan önce gereksiz bekleme yok.
 *   - isCurRequestOver===true && cardNo var → ok.
 *   - isCurRequestOver===true && cardNo yok → başarısız (kullanıcı kart okutmadı).
 *   - timeout (~15s) → hata.
 *
 * VERIFY: response shape (cardNo, isCurRequestOver) canlı cihazda doğrula.
 */
export async function captureCardOnDevice(
  devIndex: string,
): Promise<{ ok: boolean; cardNo?: string; error?: string }> {
  const timeoutMs = 15_000;
  let intervalMs = DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await gatewayApiCall(
      "/ISAPI/AccessControl/CaptureCardInfo",
      "GET",
      null,
      devIndex,
    );
    if (result.status !== 200) {
      return { ok: false, error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}` };
    }
    const data = result.data as Record<string, unknown> | undefined;
    // VERIFY: wrap key (CaptureCardInfo? CardInfo?)
    const wrap = (data?.CaptureCardInfo ?? data) as Record<string, unknown> | undefined;

    const cardNo = wrap?.cardNo as string | undefined;
    const isDone = wrap?.isCurRequestOver === true;

    if (isDone && cardNo) {
      return { ok: true, cardNo };
    }
    if (isDone && !cardNo) {
      return { ok: false, error: "Kart okunamadı (okuyucudan kart gösterilmedi)" };
    }
    // Henüz devam ediyor — sleep sonra tekrar poll
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, remaining)));
    intervalMs = Math.min(intervalMs * 2, DEFAULT_POLL_MAX_INTERVAL_MS);
  }

  return { ok: false, error: `CaptureCardInfo polling timeout (${timeoutMs}ms)` };
}

/**
 * Okuyucudan canlı yüz verisi alır.
 * 1) POST /ISAPI/AccessControl/CaptureFaceData başlatır.
 * 2) captureProgress < 100 ise GET /ISAPI/AccessControl/CaptureFaceData/Progress polling.
 * 3) isCurRequestOver===true && captureProgress===100 → ok.
 *
 * DİKKAT: pollApplyProgress string-status bekler; bu endpoint sayısal progress kullanır.
 * Bu yüzden kendi poll döngüsünü içeriyor.
 *
 * VERIFY: response shape (captureProgress sayısı, isCurRequestOver bool, faceDataBase64/faceURL)
 * canlı cihazda doğrula.
 */
export async function captureFaceOnDevice(
  devIndex: string,
  opts?: { employeeNo?: string },
): Promise<{ ok: boolean; faceDataBase64?: string; faceURL?: string; error?: string }> {
  const body = {
    CaptureFaceData: {
      ...(opts?.employeeNo ? { employeeNo: opts.employeeNo } : {}),
    },
  };
  const startResult = await gatewayApiCall(
    "/ISAPI/AccessControl/CaptureFaceData",
    "POST",
    body,
    devIndex,
  );
  if (startResult.status !== 200) {
    return {
      ok: false,
      error: `CaptureFaceData başlatılamadı: HTTP ${startResult.status}: ${startResult.raw.slice(0, 200)}`,
    };
  }

  // Yanıtta yüz verisi hemen geldiyse kullan
  const startData = startResult.data as Record<string, unknown> | undefined;
  const startWrap = (startData?.CaptureFaceData ?? startData) as
    | Record<string, unknown>
    | undefined;
  const startProgress = startWrap?.captureProgress as number | undefined;
  const startDone = startWrap?.isCurRequestOver === true;

  if (startDone && startProgress === 100) {
    return {
      ok: true,
      faceDataBase64: startWrap?.faceDataBase64 as string | undefined,
      faceURL: startWrap?.faceURL as string | undefined,
    };
  }
  // Tamamlandı ama progress 100 değil → başarısız başladı (cihaz yüz görmedi)
  if (startDone && startProgress !== undefined && startProgress < 100) {
    return { ok: false, error: `Yüz alınamadı (cihaz captureProgress=${startProgress})` };
  }

  // Henüz devam ediyor — Progress endpoint'i polling
  // Fix 5: önce GET yap, sonra sleep (ilk poll'dan önce gereksiz bekleme yok);
  // son interval clamp edilir ki t≈deadline'da biten capture timeout raporlanmasın.
  const timeoutMs = 15_000;
  let intervalMs = DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const poll = await gatewayApiCall(
      "/ISAPI/AccessControl/CaptureFaceData/Progress",
      "GET",
      null,
      devIndex,
    );
    if (poll.status !== 200) {
      return {
        ok: false,
        error: `CaptureFaceData/Progress: HTTP ${poll.status}: ${poll.raw.slice(0, 200)}`,
      };
    }
    const pd = poll.data as Record<string, unknown> | undefined;
    // VERIFY: wrap key
    const pw = (pd?.CaptureFaceDataProgress ?? pd?.CaptureFaceData ?? pd) as
      | Record<string, unknown>
      | undefined;

    const progress = pw?.captureProgress as number | undefined;
    const isDone = pw?.isCurRequestOver === true;

    if (isDone && progress === 100) {
      return {
        ok: true,
        faceDataBase64: pw?.faceDataBase64 as string | undefined,
        faceURL: pw?.faceURL as string | undefined,
      };
    }
    if (isDone && progress !== undefined && progress < 100) {
      return { ok: false, error: `Yüz alınamadı (captureProgress=${progress})` };
    }
    // isDone===false → polling devam; sleep + backoff (clamp'li kalan süre)
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, remaining)));
    intervalMs = Math.min(intervalMs * 2, DEFAULT_POLL_MAX_INTERVAL_MS);
  }

  return { ok: false, error: `CaptureFaceData polling timeout (${timeoutMs}ms)` };
}

