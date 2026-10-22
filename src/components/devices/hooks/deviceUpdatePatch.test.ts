import { describe, expect, it } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { buildDeviceFormValues } from "./buildDeviceFormValues";
import { deviceUpdatePatch } from "./deviceUpdatePatch";

const deviceId = "device" as Id<"devices">;
const baseline = buildDeviceFormValues({ name: "Panel", brand: "hikvision", hikTransport: "gateway", devicePassword: "secret", deviceUsername: "user", ehomeID: "id", ehomeKey: "key", hikPort: 8000 });
describe("device update patch", () => {
  it("yalnız ad değişirse değişmeyen sırlar dahil diğer anahtarları çıkarır", () => {
    expect(deviceUpdatePatch({ deviceId, name: "Yeni", devicePassword: "secret", deviceUsername: "user", ehomeKey: "key", status: "active", accessDirection: "both", brand: "hikvision", deviceIp: null, description: null }, { ...baseline, name: "Yeni" }, baseline)).toEqual({ deviceId, name: "Yeni" });
  });
  it("değişiklik yoksa yalnız kimlik kalır", () => {
    expect(deviceUpdatePatch({ deviceId, name: "Panel", devicePassword: "secret", hikTransport: "gateway" }, baseline, baseline)).toEqual({ deviceId });
  });
  it("localBridge geçişinde port ve kaynakta değişmeyen kimlik bilgilerini taşır", () => {
    expect(deviceUpdatePatch({ deviceId, hikTransport: "localBridge", hikPort: 8000, deviceUsername: "user", devicePassword: "secret" }, { ...baseline, hik_transport: "localBridge" }, baseline)).toEqual({ deviceId, hikTransport: "localBridge", hikPort: 8000, deviceUsername: "user", devicePassword: "secret" });
  });
  it("gateway geçişinde kaynakta değişmeyen ehome kimliğini taşır", () => {
    const previous = { ...baseline, hik_transport: "localBridge" as const };
    expect(deviceUpdatePatch({ deviceId, hikTransport: "gateway", ehomeID: "id", ehomeKey: "key" }, baseline, previous)).toEqual({ deviceId, hikTransport: "gateway", ehomeID: "id", ehomeKey: "key" });
  });
  it("açık IP/açıklama/model temizliğinin null değerlerini korur", () => {
    const previous = { ...baseline, device_ip: "host", description: "açıklama", hik_model: "DS-K2804" };
    expect(deviceUpdatePatch({ deviceId, deviceIp: null, description: null, hikModel: null }, { ...baseline, hik_model: "__manual__" }, previous)).toEqual({ deviceId, deviceIp: null, description: null, hikModel: null });
  });
  it("IDE sırları değişmediyse hiçbir sır anahtarı bırakmaz", () => {
    const values = buildDeviceFormValues({ brand: "ide_smart", ideUser: "user", idePassword: "secret" });
    expect(deviceUpdatePatch({ deviceId, ideUser: "user", idePassword: "secret" }, values, values)).toEqual({ deviceId });
  });
  it("bilinçli boş localBridge şifresini korur, undefined IDE alanını çıkarır", () => {
    const values = { ...baseline, device_password: "", ide_password: "" };
    expect(deviceUpdatePatch({ deviceId, devicePassword: "", idePassword: undefined }, values, { ...baseline, ide_password: "old" })).toStrictEqual({ deviceId, devicePassword: "" });
  });
  it("undefined değerli anahtarları boş mutation saymaz", () => {
    const values = { ...baseline, door_count: 2, ide_door_count: 3, name: "Yeni" };
    const patch = deviceUpdatePatch({ deviceId, name: "Yeni", doorCount: undefined, ideDoorCount: undefined, hikPort: undefined }, values, baseline);
    expect(Object.keys(patch)).toEqual(["deviceId", "name"]);
  });
  it("konum/yön/durum/tip yalnız değiştiyse kalır", () => {
    const values = { ...baseline, zone_id: "zone", door_id: "door", access_direction: "entry" as const, status: "inactive" as const, device_type: "Diğer" };
    const full = { deviceId, zoneId: "zone" as Id<"zones">, doorId: "door" as Id<"doors">, accessDirection: "entry" as const, status: "inactive" as const, deviceType: "Diğer" };
    expect(deviceUpdatePatch(full, values, baseline)).toEqual(full);
    expect(deviceUpdatePatch(full, values, values)).toEqual({ deviceId });
  });
});
