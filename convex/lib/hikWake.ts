export const NEXT_POLL_SECONDS = 900;

export async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function streamTicket(secret: string, bridgeId: string): Promise<string> {
  return hmacHex(secret, `stream.${bridgeId}`);
}

export function signWakeRequest(secret: string, ts: number | string, rawBody: string): Promise<string> {
  return hmacHex(secret, `${ts}.${rawBody}`);
}

export function planNextWake(
  now: number,
  nextWakeAt: number | undefined,
  minGapMs = 2000,
): { schedule: false } | { schedule: true; fireAt: number } {
  if (nextWakeAt !== undefined && nextWakeAt >= now) return { schedule: false };
  const fireAt = nextWakeAt !== undefined && now - nextWakeAt < minGapMs
    ? nextWakeAt + minGapMs
    : now;
  return { schedule: true, fireAt };
}

export function relayConfig(env: { HIK_RELAY_URL?: string; HIK_RELAY_SECRET?: string }): {
  url: string;
  secret: string;
} | null {
  const url = env.HIK_RELAY_URL?.trim().replace(/\/+$/, "");
  const secret = env.HIK_RELAY_SECRET;
  return url && secret?.trim() ? { url, secret } : null;
}

/** Backoff'ta bekleyen (henüz due olmayan, deneme hakkı kalan) en erken işin zamanı; yoksa null. */
export function earliestPendingRetryAt(
  ops: ReadonlyArray<{ nextRetryAt?: number; attemptCount: number }>,
  now: number,
  maxAttempts: number,
): number | null {
  let earliest: number | null = null;
  for (const op of ops) {
    const at = op.nextRetryAt ?? 0;
    if (at <= now || op.attemptCount >= maxAttempts) continue;
    if (earliest === null || at < earliest) earliest = at;
  }
  return earliest;
}

/** Roster `nextDueInSeconds` ipucu: en az 1 sn, yukarı yuvarlanır. */
export function secondsUntil(at: number | null, now: number): number | null {
  return at === null ? null : Math.max(1, Math.ceil((at - now) / 1000));
}
