import { describe, expect, it } from "vitest";
import { zoneDeleteBlocker } from "./doorZoneDelete";

describe("bölge silme bağımlılıkları", () => {
  it("boş bölgenin silinmesine izin verir", () => {
    expect(zoneDeleteBlocker(false, false)).toBeNull();
  });
  it("kapı varsa taşımayı veya silmeyi ister", () => {
    expect(zoneDeleteBlocker(true, false)).toContain("Önce kapıları");
  });
  it("cihaz varsa taşımayı veya silmeyi ister", () => {
    expect(zoneDeleteBlocker(false, true)).toContain("Önce cihazları");
  });
  it("her iki bağımlılığı birlikte açıklar", () => {
    expect(zoneDeleteBlocker(true, true)).toContain("Önce kapıları ve cihazları");
  });
});
