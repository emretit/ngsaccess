import { describe, expect, it } from "vitest";
import { profileName, validateSettingsNumbers } from "./settingsUx";
describe("ayar sınırları", () => {
  it.each([0, -1, NaN, Infinity, -Infinity])("saat tabanı %s reddedilir", value => {
    expect(() => validateSettingsNumbers({ monthlyHoursBase: value })).toThrow();
  });
  it.each([NaN, Infinity, -1, 0, 0.9])("çarpan %s reddedilir", value => {
    expect(() => validateSettingsNumbers({ weekdayMultiplier: value })).toThrow();
  });
  it.each([NaN, Infinity, -1, 0, 65536, 1.5])("port %s reddedilir", value => {
    expect(() => validateSettingsNumbers({ smtpPort: value })).toThrow();
  });
  it.each(["24:00", "22:60", "", "2:00"])("saat %s reddedilir", value => {
    expect(() => validateSettingsNumbers({ nightShiftStart: value })).toThrow();
  });
  it("geçerli sınırlar ve kapalı boolean korunur", () => {
    expect(() => validateSettingsNumbers({ monthlyHoursBase: 225, annualOvertimeLimitHours: 0, overtimeStartToleranceMinutes: 0, weekdayMultiplier: 1, smtpPort: 65535, smtpSecure: false, nightShiftEnd: "06:00" })).not.toThrow();
  });
  it.each(["", "  ", "\n\t"])("boş profil adı reddedilir", value => expect(() => profileName(value)).toThrow("Ad soyad"));
  it("profil adı kırpılarak saklanır", () => expect(profileName("  Ada Soyad  ")).toBe("Ada Soyad"));
});
