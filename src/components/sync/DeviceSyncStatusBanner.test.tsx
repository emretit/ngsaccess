import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceSyncStatusBanner } from "./DeviceSyncStatusBanner";

const mocks = vi.hoisted(() => ({ useQuery: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: mocks.useQuery }));
vi.mock("@/hooks/access-rules/deviceSyncStore", () => ({ useDeviceSyncing: () => false }));
vi.mock("@/hooks/useActiveProjectScope", () => ({
  useActiveProjectScope: () => ({ projectId: "project", loading: false }),
}));
vi.mock("@/hooks/useNow", () => ({ useNow: () => Date.now() }));

const NOW = Date.parse("2026-10-19T15:20:00Z");
const DAY_MS = 86_400_000;

function renderVerified(lastVerifiedAt: number | null) {
  mocks.useQuery.mockReturnValue({
    failed: 0, inFlight: 0, unknown: false, upToDate: true,
    hasMore: false, dismissedFailed: 0, lastVerifiedAt,
  });
  return renderToStaticMarkup(<DeviceSyncStatusBanner />);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("verified device sync history", () => {
  it("shows a concise Turkey timestamp and moves the explanation to a title", () => {
    const html = renderVerified(NOW);
    expect(html).toContain("Son doğrulanan cihaz senkronu: 19.10.2026 18:20");
    expect(html).toContain('title="Türkiye saati; yeni gönderimin sonucu değildir."');
    expect(html).not.toContain("Geçmiş doğrulanmış");
    expect(html).not.toContain("status-warning-badge");
  });

  it("warns for old history with a relative age", () => {
    const html = renderVerified(Date.parse("2026-06-20T09:20:00Z"));
    expect(html).toContain("20.06.2026 12:20");
    expect(html).toContain("4 ay önce");
    expect(html).toContain("status-warning-badge");
  });

  it("starts warning only after seven days", () => {
    expect(renderVerified(NOW - 7 * DAY_MS)).not.toContain("status-warning-badge");
    expect(renderVerified(NOW - 7 * DAY_MS - 1)).toContain("status-warning-badge");
  });

  it("hides verified history when the page opts out", () => {
    mocks.useQuery.mockReturnValue({
      failed: 0, inFlight: 0, unknown: false, upToDate: true,
      hasMore: false, dismissedFailed: 0, lastVerifiedAt: NOW,
    });
    const html = renderToStaticMarkup(<DeviceSyncStatusBanner hideVerified />);
    expect(html).toContain("Bekleyen işlem yok");
    expect(html).not.toContain("Son doğrulanan");
  });

  it("omits history without a verified timestamp", () => {
    expect(renderVerified(null)).not.toContain("Son doğrulanan cihaz senkronu");
    mocks.useQuery.mockReturnValue(undefined);
    expect(renderToStaticMarkup(<DeviceSyncStatusBanner />)).toBe("");
  });
});
