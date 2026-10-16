export function validateSettingsNumbers(fields: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (key === "smtpPort") {
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 65535) throw new Error("SMTP portu 1–65535 arasında tam sayı olmalıdır.");
    } else if (key.endsWith("Multiplier") || key === "monthlyHoursBase" || key.endsWith("Minutes") || key === "annualOvertimeLimitHours") {
      const min = key.endsWith("Multiplier") ? 1 : 0;
      if (typeof value !== "number" || !Number.isFinite(value) || value < min || (key === "monthlyHoursBase" && value === 0)) throw new Error("Mesai sayıları geçerli aralıkta olmalıdır: saat tabanı sıfırdan büyük, çarpanlar en az 1, limit ve toleranslar negatif olmayan sonlu sayılar.");
    } else if (key === "nightShiftStart" || key === "nightShiftEnd") {
      if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Gece saatini SS:DD biçiminde girin.");
    }
  }
}
export function profileName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error("Ad soyad boş bırakılamaz.");
  return name;
}
