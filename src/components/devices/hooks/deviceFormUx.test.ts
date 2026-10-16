import { describe, expect, it } from "vitest";
import { buildDeviceFormValues } from "./buildDeviceFormValues";
import { makeFormSchema } from "./useDeviceFormSchema";

describe("cihaz formu doğruluğu", () => {
  it("pasif kayıt yalnız ad düzenlemesinde pasif kalır", () => {
    expect(buildDeviceFormValues({ name: "Pasif panel", status: "inactive" }).status).toBe("inactive");
    expect(buildDeviceFormValues({ name: "Eski panel", isActive: false }).status).toBe("inactive");
  });
  it("yerel bridge bağlantı bilgilerini zorunlu kılar", () => {
    const values = { ...buildDeviceFormValues(null, "hikvision"), name: "Panel", device_serial: "serial", hik_transport: "localBridge", hik_model: "__manual__" };
    const result = makeFormSchema(false, true).safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(["device_ip", "device_username", "device_password"]));
  });
  it("IDE HTTP portu üst sınırını denetler", () => {
    const values = { ...buildDeviceFormValues(null, "ide_smart"), name: "Panel", ide_uuid: "uuid", ide_http_port: 65536 };
    const result = makeFormSchema(false).safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === "ide_http_port")).toBe(true);
  });
});
