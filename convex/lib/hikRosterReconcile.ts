import { asKeyPart } from "./hikKeyPart";

/** Reuse Hik queue identity normalization: trim only, never numeric/IDE coercion.
 * Keep the original device spelling for the actual deletion request. */
export function planHikRosterReconcile(
  onDevice: readonly string[],
  expected: ReadonlySet<string> | null,
  allowEmptyExpected: boolean,
): { toDelete: string[]; safe: boolean; skippedReason?: string } {
  if (expected === null) return { toDelete: [], safe: false, skippedReason: "expected_unavailable" };
  const expectedKeys = new Set([...expected].map(asKeyPart));
  if (expectedKeys.has(null) || onDevice.some(value => asKeyPart(value) === null)) {
    return { toDelete: [], safe: false, skippedReason: "invalid_identity" };
  }
  if (!allowEmptyExpected && onDevice.length > 0 && expectedKeys.size === 0) {
    return { toDelete: [], safe: false, skippedReason: "expected_empty" };
  }
  return {
    safe: true,
    toDelete: [...new Set(onDevice)].filter(value => !expectedKeys.has(asKeyPart(value))),
  };
}
