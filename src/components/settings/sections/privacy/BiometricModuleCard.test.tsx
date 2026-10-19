import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { BiometricModuleCard, BIOMETRIC_WARNING, validBiometricReason } from "./BiometricModuleCard";

const state = vi.hoisted(() => ({ enabled: false, legacy: false, changedAt: null as string | null }));
vi.mock("convex/react", () => ({
  useQuery: () => ({ ...state, reason: null, changedBy: null }),
  useMutation: () => vi.fn(),
}));
const projectId = "project" as Id<"projects">;

describe("biyometri ayar kartı", () => {
  it("açarken kırpılmış gerekçe zorunludur", () => {
    for (const reason of ["", " ", " ab ", "a".repeat(501)]) expect(validBiometricReason(true, reason)).toBe(false);
    expect(validBiometricReason(true, " abc ")).toBe(true);
    expect(validBiometricReason(false, "")).toBe(true);
  });
  it("kapalı durumunu ve uyarının tamamını gösterir", () => {
    state.enabled = false; state.legacy = false;
    const html = renderToStaticMarkup(<BiometricModuleCard projectId={projectId} />);
    expect(html).toContain("Kapalı");
    expect(html).toContain("Modülü aç");
    expect(html).toContain(BIOMETRIC_WARNING);
    expect(html).toContain("şablonlarını silmez");
    expect(html).not.toContain("eski ayarla açık");
  });
  it("eski projede açık durumunu ve geçiş notunu gösterir", () => {
    state.enabled = true; state.legacy = true;
    const html = renderToStaticMarkup(<BiometricModuleCard projectId={projectId} />);
    expect(html).toContain("Açık");
    expect(html).toContain("Modülü kapat");
    expect(html).toContain("Bu proje eski ayarla açık; gerekmiyorsa kapatın.");
  });
  it("13-O7 renders the last change in Istanbul time", () => {
    state.changedAt = "2026-01-01T23:15:00Z";
    const html = renderToStaticMarkup(<BiometricModuleCard projectId={projectId} />);
    expect(html).toContain("02.01.2026 02:15");
    state.changedAt = null;
  });

});
