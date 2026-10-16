export function deviceIdentityError(
  value: string,
  brand: "ide_smart" | "hikvision" | "other" = "ide_smart",
): string | undefined {
  const identity = value.trim();
  if (!identity) return "Cihaz kimliği gerekli";
  if (brand === "ide_smart" && !/^\d{15}$/.test(identity))
    return "IDE SYSTEM.UUID tam 15 rakam olmalı; 16 haneli seri numarası kullanmayın";
  return undefined;
}
