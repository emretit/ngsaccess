import { describe, expect, it, vi } from "vitest";
import { createAsyncGuard } from "./asyncGuard";

describe("createAsyncGuard", () => {
  it("aynı anda ikinci çağrıyı yok sayar ve başarıyı bekler", async () => {
    const guard = createAsyncGuard();
    let finish: () => void = () => {};
    const operation = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const first = guard.run(operation);
    expect(guard.pending).toBe(true);
    expect(await guard.run(operation)).toEqual({ status: "ignored" });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(guard.pending).toBe(true);
    finish();
    expect(await first).toEqual({ status: "success" });
    expect(guard.pending).toBe(false);
    expect(await guard.run(async () => {})).toEqual({ status: "success" });
  });
  it("asenkron hatayı taşır ve tekrar denemeye izin verir", async () => {
    const guard = createAsyncGuard();
    const error = new Error("Kaydedilemedi");
    expect(await guard.run(() => Promise.reject(error))).toEqual({ status: "error", error });
    expect(guard.pending).toBe(false);
    expect(await guard.run(async () => {})).toEqual({ status: "success" });
  });
  it("senkron throw da kilidi serbest bırakır", async () => {
    const guard = createAsyncGuard();
    expect(await guard.run(() => { throw "Hata"; })).toEqual({ status: "error", error: "Hata" });
    expect(guard.pending).toBe(false);
  });
});
