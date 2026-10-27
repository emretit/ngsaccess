import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DoorPlanImpactSummary } from "./DoorPlanImpactSummary";
import { DOOR_STATUS_DAYS, type DoorStatusPlan } from "../../../../convex/lib/doorStatusPlan";

const status: DoorStatusPlan = { enabled: true, beginTime: "08:00:00", endTime: "09:00:00", mode: "remainOpen" };
const render = (props: Partial<Parameters<typeof DoorPlanImpactSummary>[0]>) => renderToStaticMarkup(<DoorPlanImpactSummary doorName="Ana giriş" template={false} {...props} />);
describe("04-H2 kapıya etkisi", () => {
  it("hafta içi aynı aralıkları kısaltır ve sürekli açık etkisini uyarır", () => {
    const html = render({ statusPlan: { ...status, weekly: DOOR_STATUS_DAYS.slice(0, 5).map(day => ({ day, segments: [status] })) } });
    expect(html).toContain("Ana giriş");
    expect(html).toContain("Pzt–Cum 08:00–09:00 sürekli açık kalacak");
    expect(html).toContain('class="text-warning"');
  });
  it.each(["remainClosed", "normal"] as const)("%s kapı davranışını açıklar", mode => {
    expect(render({ statusPlan: { ...status, mode } })).toContain(mode === "normal" ? "normal çalışır" : "sürekli kilitli kalacak");
  });
  it("uzun haftalık planı aralık sayısıyla kısaltır ve açık etkisini korur", () => {
    const html = render({ statusPlan: { ...status, weekly: DOOR_STATUS_DAYS.map((day, index) => ({ day, segments: [{ ...status, beginTime: `0${index}:00` }] })) } });
    expect(html).toContain("Haftalık · 7 aralık");
    expect(html).toContain("Sürekli açık aralıklar içerir");
    expect(html).toContain('class="text-warning"');
  });
  it("doğrulama ve tatil etkilerini ayrı satırlarda gösterir", () => {
    const html = render({ verifyPlan: { enabled: true, beginTime: "08:00", endTime: "18:00", verifyMode: "card" }, holiday: { enabled: true, year: 2026, mode: "remainOpen" } });
    expect(html).toContain("Doğrulama planı: Her gün 08:00–18:00 Kart");
    expect(html).toContain("Tatil planı: 2026 tatillerinde tam gün sürekli açık kalacak");
    expect(html).toContain('class="text-warning"');
  });
  it("devre dışı planın açık aralığını uygulanacak gibi göstermez", () => {
    const html = render({ statusPlan: { ...status, enabled: false } });
    expect(html).toContain("Etkin değil; kapı normal çalışır");
    expect(html).not.toContain("text-warning");
  });
  it("şablon seçilince eski saatleri özetlemez", () => {
    const html = render({ statusPlan: status, template: true });
    expect(html).toContain("Seçilen zaman şablonundaki saatlerde sürekli açık kalacak");
    expect(html).not.toContain("08:00");
  });
});
