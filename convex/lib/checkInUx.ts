/** Tüketilmiş QR aynı sonucu döndürür; süre yalnız ilk tüketimde uygulanır. */
export function checkInTokenState(record: { usedAt?: string; expiresAt: string } | null, now: number) {
  if (!record) return 'invalid';
  if (record.usedAt) return 'completed';
  const expiresAt = Date.parse(record.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now ? 'expired' : 'ready';
}

export const CHECK_IN_TOKEN_TTL_MS = 60_000;

/** Konum izni yanıtlanmasa da kayıt akışı sonlu sürede devam eder. */
export async function optionalLocationWithin<T>(lookup: () => Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(lookup).catch(() => null),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
