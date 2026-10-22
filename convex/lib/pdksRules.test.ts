import { expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import { createPdksRulePolicy, LEGACY_PDKS_POLICY, matchesPdksCheckpoint, type PdksDayPolicy } from "./pdksRules";
import { filterPdksReadings } from "./pdksSource";
const deviceId = "d" as Id<"devices">;
const selected: PdksDayPolicy = { ...LEGACY_PDKS_POLICY, checkpointMode: "selected", targets: [{ targetType: "door", deviceId, doorId: "deleted" as Id<"doors">, ioId: 2 }] };
it("IDE snapshot kapı silindikten sonra da yalnız cihaz+IO eşler", () => {
  expect(matchesPdksCheckpoint({ deviceId, ideIoId: 2 }, selected)).toBe(true);
  expect(matchesPdksCheckpoint({ deviceId, ideIoId: 1 }, selected)).toBe(false);
  expect(matchesPdksCheckpoint({ deviceId: "other", ideIoId: 2 }, selected)).toBe(false);
  expect(matchesPdksCheckpoint({}, selected)).toBe(false);
});
it("cihaz hedefi ve tek kapılı cihaz tüm geçişlerini eşler", () => {
  for (const targetType of ["door", "device"] as const) expect(matchesPdksCheckpoint({ deviceId, ideIoId: 0 }, { ...selected, targets: [{ targetType, deviceId }] })).toBe(true);
});
it("proje+kaynak+check point aynı sınırda; mobil/QR selected'da hariç", () => {
  const readings = [ { projectId: "p" as Id<"projects">, cardNo: "1", deviceId, ideIoId: 2 }, { projectId: "p" as Id<"projects">, cardNo: "1", deviceId, ideIoId: 1 }, { projectId: "p" as Id<"projects">, cardNo: "1", rawData: '{"source":"mobile"}' }, { projectId: "other" as Id<"projects">, cardNo: "1", deviceId, ideIoId: 2 } ];
  expect(filterPdksReadings(readings, "p", () => selected)).toEqual([readings[0]]);
  expect(filterPdksReadings(readings.slice(1), "p", () => selected)).toEqual([]);
});
it("sürüm yoksa legacy+all; sınırdaki gece çıkışı giriş gününün sürümünü alır", () => {
  const forDay = createPdksRulePolicy([{ ...selected, effectiveFrom: "2026-10-23" }, { ...LEGACY_PDKS_POLICY, effectiveFrom: "2026-10-24" }]);
  expect(forDay("2026-10-22")).toEqual(LEGACY_PDKS_POLICY);
  expect(forDay("2026-10-23")).toMatchObject(selected);
  expect(forDay("2026-10-24")).toMatchObject(LEGACY_PDKS_POLICY);
});
