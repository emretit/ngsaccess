/** UTC epoch milliseconds; missing fields preserve legacy access. */
export function accessBlockReason(
  user: { disabledAt?: number; accessExpiresAt?: number },
  now: number,
): "disabled" | "expired" | null {
  if (user.disabledAt !== undefined) return "disabled";
  if (user.accessExpiresAt !== undefined && user.accessExpiresAt <= now) return "expired";
  return null;
}
