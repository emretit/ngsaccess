import { describe, expect, it, vi } from "vitest";
import { createUnsavedChangesGuard } from "./unsavedChanges";

describe("kaydedilmemiş değişiklik koruması", () => {
  it("temiz form uyarısız kapanır", () => {
    const close = vi.fn();
    expect(createUnsavedChangesGuard().request(false, close)).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("dirty form onaya kadar açık kalır; Çık yalnız bir kez çalışır", () => {
    const close = vi.fn(), guard = createUnsavedChangesGuard();
    expect(guard.request(true, close)).toBe(true);
    expect(close).not.toHaveBeenCalled();
    guard.confirm(); guard.confirm();
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("Vazgeç önceki kapanış niyetini iptal eder", () => {
    const close = vi.fn(), guard = createUnsavedChangesGuard();
    guard.request(true, close); guard.cancel(); guard.confirm();
    expect(close).not.toHaveBeenCalled();
  });
  it("yeni kapatma isteği yalnız güncel callback'i çalıştırır", () => {
    const oldClose = vi.fn(), currentClose = vi.fn(), guard = createUnsavedChangesGuard();
    guard.request(true, oldClose); guard.request(true, currentClose); guard.confirm();
    expect(oldClose).not.toHaveBeenCalled(); expect(currentClose).toHaveBeenCalledTimes(1);
  });
});
