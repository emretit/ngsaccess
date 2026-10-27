import { describe, expect, it, vi } from "vitest";
import { allDoorPlansApplied, applySelectedDoorPlans, doorPlanTimeSchema } from "./doorPlanResult";

describe("kapı planı saatleri", () => {
  it("geçerli HH:mm aralığını kabul eder", () => {
    expect(doorPlanTimeSchema.safeParse({ beginTime: "00:00", endTime: "23:59" }).success).toBe(true);
  });
  it.each([
    ["08:00", "08:00"], ["18:00", "08:00"], ["24:00", "23:59"],
    ["8:00", "18:00"], ["08:60", "18:00"], ["", "18:00"], ["08:00:00", "18:00"],
  ])("geçersiz aralığı reddeder: %s–%s", (beginTime, endTime) => {
    expect(doorPlanTimeSchema.safeParse({ beginTime, endTime }).success).toBe(false);
  });
});

describe("bağımsız plan gönderimi", () => {
  it("kısmi başarısızlıkta başarılı planı tekrar göndermez", async () => {
    const status = vi.fn().mockResolvedValue({ ok: true });
    const verify = vi.fn().mockResolvedValueOnce({ ok: false, error: "Cihaz çevrimdışı" }).mockResolvedValueOnce({ ok: true });
    const actions = { status, verify };
    const initial = await applySelectedDoorPlans(["status", "verify"], actions, String);
    expect(initial).toEqual([
      { key: "status", ok: true }, { key: "verify", ok: false, error: "Cihaz çevrimdışı" },
    ]);
    const retry = await applySelectedDoorPlans(initial.filter((result) => !result.ok).map((result) => result.key), actions, String);
    expect(retry).toEqual([{ key: "verify", ok: true }]);
    expect(status).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledTimes(2);
  });
  it("action exception'ını ayrı başarısız sonuç olarak korur", async () => {
    const results = await applySelectedDoorPlans(["status", "verify"], {
      status: async () => { throw new Error("Bağlantı kesildi"); },
      verify: async () => ({ ok: true }),
    }, (error) => error instanceof Error ? error.message : "Hata");
    expect(results).toEqual([
      { key: "status", ok: false, error: "Bağlantı kesildi" }, { key: "verify", ok: true },
    ]);
  });
});

it("04-H1 boş gönderim başarı değildir ve eylem çağırmaz", async () => {
  const status = vi.fn();
  const verify = vi.fn();
  const results = await applySelectedDoorPlans([], { status, verify }, String);
  expect(allDoorPlansApplied(results)).toBe(false);
  expect(status).not.toHaveBeenCalled();
  expect(verify).not.toHaveBeenCalled();
  expect(allDoorPlansApplied([{ key: "status", ok: true }])).toBe(true);
  expect(allDoorPlansApplied([{ key: "status", ok: false, error: "Hata" }])).toBe(false);
});
