import { describe, expect, it } from "vitest";
import { canRetrySync, decideSyncStatus, scanSyncScope, summarizeSyncRows, syncDismissPatch } from "./syncStatusLogic";

type Row = { projectId?: string; deviceProject?: string; status: string; dismissedAt?: number };
const empty = summarizeSyncRows([]);
const reader = (rows: Row[]) => async (projectId: string | undefined, status: string, limit: number) =>
  rows.filter((row) => row.projectId === projectId && row.status === status).slice(0, limit);

describe("senkron doğruluğu", () => {
  it("201 başka proje kaydı aktif projenin hatasını limit dışına itmez", async () => {
    const rows: Row[] = [...Array.from({ length: 201 }, () => ({ projectId: "other", status: "failed" })),
      { projectId: "active", status: "failed" }];
    const scan = await scanSyncScope<string, string, Row>(["active"], ["failed"], reader(rows), async (row) => row.deviceProject);
    expect(decideSyncStatus(empty, summarizeSyncRows(scan.rows), scan.unknown, 1)).toMatchObject({ failed: 1, upToDate: false, unknown: false });
  });
  it("kapatma status değiştirmez ve başarısızlık sayımını azaltmaz", () => {
    const failed = { status: "failed", ...syncDismissPatch("user", 20) };
    expect(summarizeSyncRows([failed])).toEqual({ failed: 1, dismissedFailed: 1, inFlight: 0 });
    expect(syncDismissPatch("user", 20)).toEqual({ dismissedAt: 20, dismissedBy: "user" });
    expect(decideSyncStatus(empty, summarizeSyncRows([failed]), false, 10).upToDate).toBe(false);
  });
  it("eksik tarama kesin yeşil üretmez", async () => {
    const rows = Array.from({ length: 201 }, () => ({ projectId: "active", status: "pending" }));
    const scan = await scanSyncScope<string, string, Row>(["active"], ["pending"], reader(rows), async () => undefined);
    expect(scan.hasMore).toBe(true);
    expect(decideSyncStatus(empty, empty, scan.unknown, 10).upToDate).toBe(false);
  });
  it("tam sınırda tarama kesin sayılabilir", async () => {
    const rows = Array.from({ length: 200 }, () => ({ projectId: "active", status: "failed" }));
    const scan = await scanSyncScope<string, string, Row>(["active"], ["failed"], reader(rows), async () => undefined);
    expect(scan.hasMore).toBe(false);
    expect(scan.rows).toHaveLength(200);
  });
  it("eski operasyon kapsamını cihazdan çözer, diğer projeyi dışarıda tutar", async () => {
    const rows = [{ status: "failed", deviceProject: "active" }, { status: "failed", deviceProject: "other" }];
    const scan = await scanSyncScope<string, string, Row>(["active"], ["failed"], reader(rows), async (row) => row.deviceProject);
    expect(scan.rows).toEqual([{ status: "failed", deviceProject: "active", projectId: "active" }]);
    expect(scan.unknown).toBe(false);
  });
  it("cihazı silinmiş kapsamsız operasyon durumu bilinmiyor yapar", async () => {
    const scan = await scanSyncScope<string, string, Row>(["active"], ["failed"], reader([{ status: "failed" }]), async () => undefined);
    expect(scan.unknown).toBe(true);
    expect(decideSyncStatus(empty, empty, scan.unknown, 10).upToDate).toBe(false);
  });
  it("boş kuyruk cihaz onayı değildir", () => {
    expect(decideSyncStatus(empty, empty, false, null).upToDate).toBe(false);
    expect(decideSyncStatus(empty, empty, false, 123)).toMatchObject({ upToDate: true, lastVerifiedAt: 123 });
  });
  it("yeniden deneme yalnız failed durumunda değişiklik yapar", () => {
    expect(canRetrySync("failed")).toBe(true);
    for (const status of ["pending", "processing", "sent", "acked", "done"]) expect(canRetrySync(status)).toBe(false);
  });
});
