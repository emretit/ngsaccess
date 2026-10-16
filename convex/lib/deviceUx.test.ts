import { describe, expect, it } from "vitest";
import { deviceActive, validateDeviceDoor, isDeviceHost } from "./deviceUx";
import { toPatch } from "./nullablePatch";
import { deviceConnection, DEVICE_ONLINE_WINDOW_MS } from "./deviceConnection";

describe("cihaz kayıt ve bağlantı sözleşmesi", () => {
  it("pasif kayıt bağlantıdan bağımsız korunur", () => {
    expect(deviceActive("inactive", true)).toBe(false);
    expect(deviceActive(undefined, false)).toBe(false);
    expect(deviceActive("active", false)).toBe(true);
  });
  it("temizlenen açıklama/IP/model alanlarını siler, atlanan alanı korur", () => {
    const patch = toPatch({ description: null, deviceIp: null, hikModel: null, name: undefined });
    expect(Object.keys(patch)).toEqual(["description", "deviceIp", "hikModel"]);
    expect(patch.description).toBeUndefined();
  });
  it("başka panel, proje ve bölge kapısını reddeder", () => {
    const device = { _id: "panel", projectId: "p", zoneId: "z" };
    expect(() => validateDeviceDoor(device, { deviceId: "other", projectId: "p", zoneId: "z" })).toThrow("başka");
    expect(() => validateDeviceDoor(device, { projectId: "q", zoneId: "z" })).toThrow("projesinde");
    expect(() => validateDeviceDoor(device, { projectId: "p", zoneId: "x" })).toThrow("tutarlı");
    expect(() => validateDeviceDoor(device, { deviceId: "panel", projectId: "p", zoneId: "z" })).not.toThrow();
  });
  it("gateway sinyalini, offline ipucunu ve süre aşımını aynı kuralla çözer", () => {
    const now = 1_000_000;
    const device = { brand: "hikvision", hikLastSeenAt: now - 1 };
    expect(deviceConnection(device, now)).toBe("online");
    expect(deviceConnection(device, now + DEVICE_ONLINE_WINDOW_MS)).toBe("offline");
    expect(deviceConnection({ ...device, hikOfflineHint: "offline" }, now)).toBe("offline");
    expect(deviceConnection({}, now)).toBe("never");
    expect(deviceConnection({ lastSeen: "invalid" }, now)).toBe("never");
    expect(deviceConnection({ brand: "hikvision", hikTransport: "localBridge", lastSeen: new Date(now).toISOString() }, now)).toBe("online");
  });
});

it("bridge sunucu adresi geçerli IP veya hostname olmalı", () => {
  for (const host of ["192.168.1.10", "panel.local", "panel-1", "::1"]) expect(isDeviceHost(host)).toBe(true);
  for (const host of ["999.1.1.1", "panel..local", "https://panel", "-panel", ""]) expect(isDeviceHost(host)).toBe(false);
});
