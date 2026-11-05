import { expect, it } from "vitest";
import { deviceLabels } from "./deviceLabels";
import { deviceDateTime } from "./deviceAdapter";
it("IDE UUID yardımı seri numarasıyla karıştırılmaz", () => {
  expect(deviceLabels.uuidHelp).toContain(
    "15 haneli UUID — seri numarası değil",
  );
});
it("eksik olay ve tarama tarihini son sinyal metniyle karıştırmaz", () => {
  expect(deviceDateTime(undefined)).toBe("—");
  expect(deviceDateTime("invalid")).toBe("—");
  expect(deviceDateTime("2026-10-21T09:00:00Z")).toBe("21.10.2026 12:00");
});
