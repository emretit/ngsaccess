import { createUnsavedChangesGuard } from "@/components/shared/unsavedChanges";
import { describe, expect, it, vi } from "vitest";
import {
  emptyWeek,
  formatSchedule,
  inspectSchedule,
  invalidTimeField,
  timeFieldError,
  overnightDescription,
  WEEKDAYS,
} from "./schedule";
import {
  addInterval,
  removeInterval,
  changeScheduleMode,
  scheduleBinding,
  requestTemplateEdit,
  initialScheduleMode,
  saveDecision,
  visibleTemplates,
} from "./model";
describe("zaman şablonu haftası", () => {
  it("ardışık aynı günleri gruplar ve 24:00 değerini korur", () => {
    const week = emptyWeek();
    for (const d of WEEKDAYS.slice(0, 5))
      week[d] = [
        { start: "08:00", end: "12:00" },
        { start: "13:00", end: "24:00" },
      ];
    week.Saturday = [{ start: "09:00", end: "13:00" }];
    expect(formatSchedule(week)).toBe(
      "Pzt–Cum 08:00–12:00, 13:00–24:00 · Cmt 09:00–13:00",
    );
  });
  it("boş hafta erişim vermez", () => {
    expect(formatSchedule(emptyWeek())).toBe("Erişim yok");
    expect(inspectSchedule(emptyWeek())).toMatchObject({
      ide: 0,
      hik: 0,
      error: "",
    });
  });
  it("aralık ekler/siler ve dokuzuncuyu engeller", () => {
    let week = emptyWeek();
    for (let i = 0; i < 8; i++) week = addInterval(week, "Monday");
    expect(week.Monday).toHaveLength(8);
    expect(addInterval(week, "Monday")).toBe(week);
    expect(removeInterval(week, "Monday", 3).Monday).toHaveLength(7);
    expect(week.Tuesday).toEqual([]);
  });
  it("gece aralığını sonraki güne böler; Pazar haftayı sarar", () => {
    const raw = emptyWeek();
    raw.Sunday = [{ start: "22:00", end: "02:00" }];
    const check = inspectSchedule(raw);
    expect(check.week?.Sunday).toEqual([{ start: "22:00", end: "24:00" }]);
    expect(check.week?.Monday).toEqual([{ start: "00:00", end: "02:00" }]);
    expect(check.overnight[0]).toContain("Ertesi güne taşan aralık");
    expect(check).toMatchObject({ hik: 1, ide: 2, error: "" });
  });
  it("örtüşen aralıkları ortak normalizeWeek üzerinden birleştirir", () => {
    const week = emptyWeek();
    week.Monday = [
      { start: "08:00", end: "12:00" },
      { start: "11:00", end: "17:00" },
    ];
    expect(inspectSchedule(week).week?.Monday).toEqual([
      { start: "08:00", end: "17:00" },
    ]);
  });
  it("IDE sekiz farklı aralık sınırını bildirir", () => {
    const week = emptyWeek();
    week.Monday = Array.from({ length: 8 }, (_, i) => ({
      start: `${String(i * 2).padStart(2, "0")}:00`,
      end: `${String(i * 2 + 1).padStart(2, "0")}:00`,
    }));
    week.Tuesday = [{ start: "20:00", end: "21:00" }];
    expect(inspectSchedule(week)).toMatchObject({
      ide: 9,
      hik: 8,
      error: expect.stringContaining("IDE:"),
    });
  });
  it("Hik sınır aşımını ve geçersiz saati reddeder", () => {
    const week = emptyWeek();
    week.Monday = Array.from({ length: 9 }, (_, i) => ({
      start: `${String(i * 2).padStart(2, "0")}:00`,
      end: `${String(i * 2 + 1).padStart(2, "0")}:00`,
    }));
    expect(inspectSchedule(week)).toMatchObject({
      week: null,
      hik: 9,
      error: expect.stringContaining("8"),
    });
    week.Monday = [{ start: "25:00", end: "26:00" }];
    expect(inspectSchedule(week).week).toBeNull();
  });
});
describe("kural ve kayıt akışı", () => {
  it("mod geçişlerinde gömülü alanları korur ve doğru bağlantıyı gönderir", () => {
    const form = {
      scheduleMode: "custom" as const,
      scheduleTemplateId: "template",
      days: ["Monday"],
      start_time: "09:00",
      end_time: "17:00",
    };
    const linked = changeScheduleMode(form, "template");
    expect(linked).toEqual({ ...form, scheduleMode: "template" });
    expect(scheduleBinding("template", linked.scheduleTemplateId)).toBe(
      "template",
    );
    const custom = changeScheduleMode(linked, "custom");
    expect(custom).toEqual(form);
    expect(
      scheduleBinding("custom", custom.scheduleTemplateId, "template"),
    ).toBeNull();
    expect(scheduleBinding("custom", "", undefined)).toBeUndefined();
    expect(initialScheduleMode("template")).toBe("template");
    expect(initialScheduleMode()).toBe("custom");
  });
  it("bağlı kaydı önizletir, onaydan sonra kaydeder ve kapasite aşımını engeller", () => {
    const input = {
      valid: true,
      pending: false,
      name: "Mesai",
      ruleCount: 2,
      confirmed: false,
      overLimit: 0,
    };
    expect(saveDecision(input)).toBe("preview");
    expect(saveDecision({ ...input, confirmed: true })).toBe("save");
    expect(saveDecision({ ...input, ruleCount: 0 })).toBe("save");
    expect(saveDecision({ ...input, confirmed: true, overLimit: 1 })).toBe(
      "disabled",
    );
    expect(saveDecision({ ...input, valid: false })).toBe("disabled");
    expect(saveDecision({ ...input, pending: true })).toBe("disabled");
  });
  it("arşiv anahtarı arşivli kayıtları açar", () => {
    const rows = [{ isArchived: true }, { isArchived: false }, {}];
    expect(visibleTemplates(rows, false)).toHaveLength(2);
    expect(visibleTemplates(rows, true)).toEqual(rows);
  });
});

describe("denetim düzeltmeleri", () => {
  it("değişmeyen şablonu güncelleme payloadından çıkarır", () => {
    expect(scheduleBinding("template", "same", "same")).toBeUndefined();
    expect(scheduleBinding("template", "new", "old")).toBe("new");
    expect(scheduleBinding("template", "new")).toBe("new");
    expect(scheduleBinding("custom", "same", "same")).toBeNull();
    expect(scheduleBinding("custom", "")).toBeUndefined();
  });
  it("kirli sihirbazda kapanış ve URL değişikliği onayı bekler; iptal gezinmez", () => {
    const guard = createUnsavedChangesGuard();
    const close = vi.fn();
    const navigate = vi.fn();
    const requestClose = (fn: () => void) => { guard.request(true, fn); };
    requestTemplateEdit(requestClose, close, navigate);
    expect(close).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    guard.cancel();
    guard.confirm();
    expect(navigate).not.toHaveBeenCalled();
    requestTemplateEdit(requestClose, close, navigate);
    guard.confirm();
    expect(close).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
  });
  it("temiz sihirbazdan doğrudan şablona gider", () => {
    const guard = createUnsavedChangesGuard();
    const calls: string[] = [];
    requestTemplateEdit(fn => { guard.request(false, fn); }, () => calls.push("close"), () => calls.push("navigate"));
    expect(calls).toEqual(["close", "navigate"]);
  });
});

describe("invalidTimeField", () => {
  it("hata nedenini yalnız ilgili alan için verir ve 24:00 bitişini kabul eder", () => {
    expect(timeFieldError({ start: "13:00", end: "25:00" }, "end")).toBe("bitiş 24:00'ü geçemez");
    expect(timeFieldError({ start: "13:00", end: "25:00" }, "start")).toBe("");
    expect(timeFieldError({ start: "8", end: "17:00" }, "start")).toContain("22:00 biçiminde");
    expect(timeFieldError({ start: "22:00", end: "24:00" }, "end")).toBe("");
    expect(timeFieldError({ start: "09:00", end: "09:00" }, "start")).toContain("farklı olmalı");
  });
  it("gece açıklamasını yalnız geçerli gece aralığı için üretir", () => {
    expect(overnightDescription("Sunday", { start: "22:00", end: "06:00" })).toContain("Pzt 00:00–06:00");
    expect(overnightDescription("Monday", { start: "25:00", end: "06:00" })).toBe("");
    expect(overnightDescription("Monday", { start: "08:00", end: "17:00" })).toBe("");
    expect(overnightDescription("Monday", { start: "08:00", end: "08:00" })).toBe("");
  });
  it("biçimi bozuk alanı ve eşit başlangıç/bitişi işaretler", () => {
    expect(invalidTimeField({ start: "08:00", end: "17:00" }, "start")).toBe(false);
    expect(invalidTimeField({ start: "8", end: "17:00" }, "start")).toBe(true);
    expect(invalidTimeField({ start: "8", end: "17:00" }, "end")).toBe(false);
    expect(invalidTimeField({ start: "22:00", end: "24:00" }, "end")).toBe(false);
    expect(invalidTimeField({ start: "24:00", end: "08:00" }, "start")).toBe(true);
    expect(invalidTimeField({ start: "09:00", end: "09:00" }, "end")).toBe(true);
  });
});
