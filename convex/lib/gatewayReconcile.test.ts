import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { collectAllPages, diffGatewayRosters } from "./gatewayReconcile";

const emptyRoster = { cards: [], faces: [], fingerprints: [] };
const emptyDiff = {
  expectedCount: 0,
  onDeviceCount: 0,
  onDeviceNotExpected: [],
  expectedNotOnDevice: [],
  faceExpectedCount: 0,
  faceOnDeviceCount: 0,
  faceOnDeviceNotExpected: [],
  faceExpectedNotOnDevice: [],
  fingerprintExpectedCount: 0,
  fingerprintOnDeviceCount: 0,
  fingerprintOnDeviceNotExpected: [],
  fingerprintExpectedNotOnDevice: [],
};

describe("diffGatewayRosters", () => {
  it("returns zero counts and empty differences for empty rosters", () => {
    expect(diffGatewayRosters(emptyRoster, emptyRoster)).toEqual(emptyDiff);
  });

  it("matches all three rosters regardless of order", () => {
    expect(diffGatewayRosters(
      { cards: ["001", "002"], faces: ["F1"], fingerprints: ["P1", "P2"] },
      { cards: ["002", "001"], faces: ["F1"], fingerprints: ["P2", "P1"] },
    )).toEqual({
      ...emptyDiff,
      expectedCount: 2,
      onDeviceCount: 2,
      faceExpectedCount: 1,
      faceOnDeviceCount: 1,
      fingerprintExpectedCount: 2,
      fingerprintOnDeviceCount: 2,
    });
  });

  it("preserves both difference directions and source order for every roster", () => {
    expect(diffGatewayRosters(
      { cards: ["C2", "C0", "C1"], faces: ["F1", "F0"], fingerprints: ["P1", "P0"] },
      { cards: ["C4", "C0", "C3"], faces: ["F0", "F2"], fingerprints: ["P0", "P2"] },
    )).toEqual({
      expectedCount: 3,
      onDeviceCount: 3,
      onDeviceNotExpected: ["C4", "C3"],
      expectedNotOnDevice: ["C2", "C1"],
      faceExpectedCount: 2,
      faceOnDeviceCount: 2,
      faceOnDeviceNotExpected: ["F2"],
      faceExpectedNotOnDevice: ["F1"],
      fingerprintExpectedCount: 2,
      fingerprintOnDeviceCount: 2,
      fingerprintOnDeviceNotExpected: ["P2"],
      fingerprintExpectedNotOnDevice: ["P1"],
    });
  });

  it("compares normalized inputs verbatim without adding padding or trimming", () => {
    // Expected roster queries trim; device search preserves cardNo. The diff
    // itself must not adopt the separate card-write path's ten-digit padding.
    expect(diffGatewayRosters(
      { ...emptyRoster, cards: ["0000000123", "456", "789"] },
      { ...emptyRoster, cards: ["0000000123", "0000000456", " 789 "] },
    )).toEqual({
      ...emptyDiff,
      expectedCount: 3,
      onDeviceCount: 3,
      onDeviceNotExpected: ["0000000456", " 789 "],
      expectedNotOnDevice: ["456", "789"],
    });
  });

  it("counts raw rows while deduplicating differences", () => {
    expect(diffGatewayRosters(
      { cards: ["1", "1"], faces: ["F1", "F1"], fingerprints: ["P1", "P1"] },
      { cards: ["2", "2", "2"], faces: ["F2", "F2"], fingerprints: ["P2", "P2"] },
    )).toEqual({
      expectedCount: 2,
      onDeviceCount: 3,
      onDeviceNotExpected: ["2"],
      expectedNotOnDevice: ["1"],
      faceExpectedCount: 2,
      faceOnDeviceCount: 2,
      faceOnDeviceNotExpected: ["F2"],
      faceExpectedNotOnDevice: ["F1"],
      fingerprintExpectedCount: 2,
      fingerprintOnDeviceCount: 2,
      fingerprintOnDeviceNotExpected: ["P2"],
      fingerprintExpectedNotOnDevice: ["P1"],
    });
  });
});

describe("collectAllPages", () => {
  afterEach(() => vi.restoreAllMocks());
  const deviceId = "device-test" as Id<"devices">;
  type Page = {
    ok: boolean;
    rows: string[];
    numMatches: number;
    nextPosition: number;
    hasMore: boolean;
    error?: string;
  };
  const itemsFromPage = (page: Page) => page.rows;

  it("follows nextPosition and stops when the device reports no more pages", async () => {
    const loadPage = vi.fn<(position: number) => Promise<Page>>()
      .mockResolvedValueOnce({ ok: true, rows: ["a"], numMatches: 1, nextPosition: 7, hasMore: true })
      .mockResolvedValueOnce({ ok: true, rows: ["b"], numMatches: 1, nextPosition: 8, hasMore: false });
    expect(await collectAllPages({ label: "kart", deviceId, maxPages: 10, loadPage, itemsFromPage }))
      .toEqual({ ok: true, items: ["a", "b"] });
    expect(loadPage.mock.calls).toEqual([[0], [7]]);
  });

  it("retains partial results on a later page failure", async () => {
    const loadPage = vi.fn<(position: number) => Promise<Page>>()
      .mockResolvedValueOnce({ ok: true, rows: ["a"], numMatches: 1, nextPosition: 1, hasMore: true })
      .mockResolvedValueOnce({ ok: false, rows: ["ignored"], numMatches: 1, nextPosition: 2, hasMore: true, error: "offline" });
    expect(await collectAllPages({ label: "yüz", deviceId, maxPages: 10, loadPage, itemsFromPage }))
      .toEqual({ ok: false, items: ["a"], error: "offline" });
    expect(loadPage.mock.calls).toEqual([[0], [1]]);
  });

  it("returns accumulated rows and the existing warning at the page cap", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const loadPage = vi.fn<(position: number) => Promise<Page>>()
      .mockResolvedValue({ ok: true, rows: ["a"], numMatches: 1, nextPosition: 1, hasMore: true });
    expect(await collectAllPages({ label: "kart", deviceId, maxPages: 1, loadPage, itemsFromPage }))
      .toEqual({ ok: true, items: ["a"] });
    expect(loadPage).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[hik-reconcile] kart maxPages=1 aşıldı, device=device-test");
  });
});
