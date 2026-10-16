import { describe, expect, it, vi } from "vitest";
import { deviceIdentityError } from "./deviceIdentity";
import { completeDeviceRegistration } from "./deviceIdentityRegistration";

describe("cihaz kimliği ve kısmi kayıt", () => {
  it("IDE yalnız 15 rakam SYSTEM.UUID kabul eder", () => {
    expect(deviceIdentityError(" 289833329732592 ")).toBeUndefined();
    for (const value of [
      "",
      "2898333297325921",
      "28983332973259",
      "28983332973259x",
    ])
      expect(deviceIdentityError(value)).toBeDefined();
  });
  it("diğer markaların mevcut boş olmayan kimlik kuralını korur", () => {
    expect(deviceIdentityError("ABC-serial", "hikvision")).toBeUndefined();
    expect(deviceIdentityError("id", "other")).toBeUndefined();
    expect(deviceIdentityError(" ", "other")).toBeDefined();
  });
  it("atama hatasından sonra tekrar register çağırmadan atar", async () => {
    const register = vi.fn(async () => "registered-id");
    const claim = vi
      .fn()
      .mockRejectedValueOnce(new Error("atama hatası"))
      .mockResolvedValueOnce(undefined);
    let saved: string | null = null;
    const onRegistered = (id: string) => {
      saved = id;
    };
    await expect(
      completeDeviceRegistration({
        registeredId: saved,
        register,
        onRegistered,
        claim,
      }),
    ).rejects.toThrow("atama hatası");
    expect(saved).toBe("registered-id");
    await completeDeviceRegistration({
      registeredId: saved,
      register,
      onRegistered,
      claim,
    });
    expect(register).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledTimes(2);
    expect(claim).toHaveBeenLastCalledWith("registered-id");
  });
  it("kayıt hatasında atama çağırmaz", async () => {
    const claim = vi.fn();
    const onRegistered = vi.fn();
    await expect(
      completeDeviceRegistration({
        registeredId: null,
        register: async () => {
          throw new Error("kayıt hatası");
        },
        onRegistered,
        claim,
      }),
    ).rejects.toThrow("kayıt hatası");
    expect(claim).not.toHaveBeenCalled();
    expect(onRegistered).not.toHaveBeenCalled();
  });
});
