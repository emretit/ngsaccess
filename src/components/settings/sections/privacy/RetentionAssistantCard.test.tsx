import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { RetentionAssistantCard, retentionDaysSchema, RETENTION_EFFECT, needsRetentionConfirmation, needsUnmaskConfirmation } from "./RetentionAssistantCard";

const mocks = vi.hoisted(() => ({ settings: { cardReadingRetentionDays: null as number | null, aiMaskNames: true }, optimistic: [] as unknown[] }));
vi.mock("convex/react", () => ({ useQuery: () => mocks.settings, useMutation: () => ({ withOptimisticUpdate: (callback: unknown) => { mocks.optimistic.push(callback); return vi.fn(); } }) }));

describe("saklama ve asistan ayarları", () => {
  it.each([365, 1824, 3651, 365.5, NaN, Infinity])("geçersiz gün sayısını reddeder: %s", days => expect(retentionDaysSchema.safeParse(days).success).toBe(false));
  it.each([1825, 3650, null])("sınırları ve süresizi kabul eder: %s", days => expect(retentionDaysSchema.safeParse(days).success).toBe(true));
  it("süresiz varsayılanı, üçüncü taraf uyarısını ve etiket biçimini gösterir", () => {
    mocks.settings = { cardReadingRetentionDays: null, aiMaskNames: true };
    const html = renderToStaticMarkup(<RetentionAssistantCard projectId={"project-a" as Id<"projects">} />);
    expect(html).toContain('value="unlimited" selected=""');
    expect(html).toContain(RETENTION_EFFECT);
    expect(html).not.toContain("PDKS kayıtları ve manuel düzeltmeler bu işlemde silinmez");
    expect(html).toContain("Kapatırsanız çalışan adları üçüncü taraf yapay zeka servisine gönderilir.");
    expect(html).toContain("Personel 1, Personel 2");
    expect(html).toContain("Kendi sorunuza yazdığınız adlar değiştirilmez.");
    expect(html).toContain('aria-checked="true"');
  });
  it("özel gün sayısını bağlı etiket ve sınırlarla gösterir; kapalı ayarı korur", () => {
    mocks.settings = { cardReadingRetentionDays: 2000, aiMaskNames: false };
    const html = renderToStaticMarkup(<RetentionAssistantCard projectId={"project-a" as Id<"projects">} />);
    expect(html).toContain('for="retention-days"');
    expect(html).toContain('min="1825"'); expect(html).toContain('max="3650"'); expect(html).toContain('value="2000"');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain("Kaydedilmemiş değişiklikler");
  });
});

describe("gizlilik onay kararları ve iyimser sorgu", () => {
  it("süresizden süreliye geçiş ve kısaltma onay ister; uzatma ve süresiz istemez", () => {
    expect(needsRetentionConfirmation(null, 1825)).toBe(true);
    expect(needsRetentionConfirmation(3650, 1825)).toBe(true);
    expect(needsRetentionConfirmation(1825, 3650)).toBe(false);
    expect(needsRetentionConfirmation(1825, null)).toBe(false);
    expect(needsRetentionConfirmation(1825, 1825)).toBe(false);
  });
  it("yalnız ad maskesini kapatmak üçüncü taraf paylaşımı onayı ister", () => {
    expect(needsUnmaskConfirmation(true, false)).toBe(true);
    expect(needsUnmaskConfirmation(false, true)).toBe(false);
    expect(needsUnmaskConfirmation(true, true)).toBe(false);
    expect(needsUnmaskConfirmation(false, false)).toBe(false);
  });
  it("saklama kaydı beklenirken sorguda yeni değer görünür ve asistan alanı korunur", () => {
    mocks.optimistic = [];
    mocks.settings = { cardReadingRetentionDays: 3650, aiMaskNames: true };
    renderToStaticMarkup(<RetentionAssistantCard projectId={"project-a" as Id<"projects">} />);
    const store = { getQuery: vi.fn(() => mocks.settings), setQuery: vi.fn() };
    const update = mocks.optimistic[0] as (store: object, args: { projectId: string; days: number }) => void;
    update(store, { projectId: "project-a", days: 1825 });
    expect(store.setQuery).toHaveBeenCalledWith(expect.anything(), { projectId: "project-a" }, { cardReadingRetentionDays: 1825, aiMaskNames: true });
  });
});
