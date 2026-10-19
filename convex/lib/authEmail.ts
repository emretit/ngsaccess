export function normalizeAuthEmail(email: unknown): string {
  if (typeof email !== "string") {
    throw new Error("Geçerli bir e-posta girin");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Geçerli bir e-posta girin");
  }

  return normalizedEmail;
}
