/** Shared policy for setting a new password; never apply it to sign-in. */
export const PASSWORD_POLICY_MESSAGE =
  "Şifre en az 8 karakter, büyük harf, küçük harf ve rakam içermelidir.";

/** Preserve the existing ASCII letter/digit checks and JavaScript string length. */
export function getPasswordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  return Object.values(getPasswordChecks(password)).every(Boolean);
}

/** Callers can return the message or wrap it in Error / ConvexError. */
export function getPasswordError(password: string): string | null {
  return isPasswordValid(password) ? null : PASSWORD_POLICY_MESSAGE;
}
