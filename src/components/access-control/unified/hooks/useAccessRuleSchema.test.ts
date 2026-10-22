import { describe, expect, it } from "vitest";
import { accessRuleSchema } from "./useAccessRuleSchema";

const input = {
  name: "Bölge",
  targetType: "visitor",
  selectedEmployees: [],
  selectedDevices: ["device"],
  selectedZones: [],
  selectedDoors: [],
  startTime: "",
  endTime: "",
  days: ["Monday"],
  accessDirection: "both",
  priority: 0,
};
describe("kullanılan erişim kuralı form şeması", () => {
  it("sıfır üyeli ziyaretçi bölgesini ve priority 0 değerini korur", () => {
    const parsed = accessRuleSchema.parse(input);
    expect(parsed.selectedEmployees).toEqual([]);
    expect(parsed.priority).toBe(0);
  });
  it("kişisel kuralda çalışan seçimini zorunlu tutar", () => {
    expect(
      accessRuleSchema.safeParse({ ...input, targetType: "individual" })
        .success,
    ).toBe(false);
  });
  it.each([
    { days: [] },
    { startTime: "09:00" },
    { endTime: "18:00" },
    { startTime: "18:00", endTime: "09:00" },
    { name: " " },
  ])("geçersiz formu reddeder: %j", (patch) => {
    expect(accessRuleSchema.safeParse({ ...input, ...patch }).success).toBe(
      false,
    );
  });
});

describe("şablon modu doğrulaması", () => {
  it("gömülü gün ve saatleri zorunlu tutmaz", () => {
    expect(
      accessRuleSchema.safeParse({
        ...input,
        scheduleMode: "template",
        scheduleTemplateId: "t",
        days: [],
        startTime: "",
        endTime: "bad",
      }).success,
    ).toBe(true);
  });
  it("şablon seçimi zorunludur", () => {
    expect(
      accessRuleSchema.safeParse({
        ...input,
        scheduleMode: "template",
        scheduleTemplateId: "",
      }).success,
    ).toBe(false);
  });
  it("özel saate dönünce gün ve saat kurallarını tekrar uygular", () => {
    expect(
      accessRuleSchema.safeParse({
        ...input,
        scheduleMode: "custom",
        scheduleTemplateId: "t",
        days: [],
      }).success,
    ).toBe(false);
  });
});
