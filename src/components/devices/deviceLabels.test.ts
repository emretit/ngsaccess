import { expect, it } from "vitest";
import { deviceLabels, deviceEventLabel } from "./deviceLabels";
import { deviceDateTime } from "./deviceAdapter";
it("komut sözlüğü cümle düzenindedir ve sonucu doğru anlatır", () => {
  expect(deviceLabels.workStatus).toBe("Çalışma durumu");
  expect(deviceLabels.reconcile).toBe("Eşitlik kontrolü");
  expect(deviceLabels.triggerSync).toBe("Panel senkronu");
  expect(deviceLabels.commandSent).toBe("Komut cihaza iletildi");
  expect(deviceLabels.uuidHelp).toContain(
    "15 haneli UUID — seri numarası değil",
  );
});
it("bilinmeyen cihaz olayını koduyla gösterir, eşlenmiş olay adını korur", () => {
  expect(deviceEventLabel("Cihaz istisnası (1031)")).toBe(
    "Cihaz olayı (kod 1031)",
  );
  expect(deviceEventLabel("Cihaz durum olayı (22)")).toBe(
    "Cihaz olayı (kod 22)",
  );
  expect(deviceEventLabel("Kapı açıldı")).toBe("Kapı açıldı");
});
it("eksik olay ve tarama tarihini son sinyal metniyle karıştırmaz", () => {
  expect(deviceDateTime(undefined)).toBe("—");
  expect(deviceDateTime("invalid")).toBe("—");
  expect(deviceDateTime("2026-10-21T09:00:00Z")).toBe("21.10.2026 12:00");
});
