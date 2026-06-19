const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_REUSABLE_TOKEN_LIFETIME_MS = 15 * 60 * 1000;

interface ExistingVerificationToken {
  setupToken?: string;
  tokenExpiresAt?: string;
}

interface VerificationTokenDecision {
  token: string;
  expiresAt: string;
  shouldPersist: boolean;
}

export function prepareVerificationToken(
  existing: ExistingVerificationToken,
  nowMs: number,
  createToken: () => string = () => crypto.randomUUID(),
): VerificationTokenDecision {
  const expiresAtMs = existing.tokenExpiresAt
    ? Date.parse(existing.tokenExpiresAt)
    : Number.NaN;

  if (
    existing.setupToken &&
    existing.tokenExpiresAt &&
    Number.isFinite(expiresAtMs) &&
    expiresAtMs - nowMs > MIN_REUSABLE_TOKEN_LIFETIME_MS
  ) {
    return {
      token: existing.setupToken,
      expiresAt: existing.tokenExpiresAt,
      shouldPersist: false,
    };
  }

  return {
    token: createToken(),
    expiresAt: new Date(nowMs + TOKEN_TTL_MS).toISOString(),
    shouldPersist: true,
  };
}
