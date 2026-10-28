import { describe, expect, it } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
defaultPersonSelection, importResultText, personImportSelection, personSelectionState,
selectablePersons, showFingerprintConsent, togglePersonSelection,
type DeviceImportPreview, type DeviceImportResult
} from "./devicePersonImportView";
const preview: DeviceImportPreview = {
  rows: ["Okan ISMAN", "Cinar ZONGUR", "Bengu AYDIN", "Mustafa Bingeloglu"]
    .map((name, index) => ({
      employeeNo: String(index + 1),
      name,
      cards: [],
      fingerCount: 1,
      status: "new" as const,
    }))
    .concat([]),
  totals: { persons: 6, cards: 1 },
};
preview.rows.push(
  {
    employeeNo: "5",
    name: "Mevcut Kişi",
    cards: ["5"],
    fingerCount: 0,
    status: "matched",
  },
  {
    employeeNo: "6",
    name: "Çakışan Kişi",
    cards: [],
    fingerCount: 0,
    status: "conflict",
    reason: "Başka projede kayıtlı",
  },
);
const imported: DeviceImportResult = {
  created: 4,
  matched: 0,
  conflicts: 0,
  manual: 0,
  consentsRecorded: 4,
  fingerprintsStored: 4,
  fingerprintsSkipped: 0,
  ruleId: "rule" as Id<"accessRules">,
};
describe("kişi seçim kararları", () => {
  it("yalnız yeni kişiler varsayılan seçilir; select-all ara durumu ve payload seçimi izler", () => {
    const selected = defaultPersonSelection(preview);
    expect(selected).toEqual(["1", "2", "3", "4"]);
    expect(selectablePersons(preview)).toHaveLength(4);
    expect(personSelectionState(preview, selected)).toBe(true);
    const reduced = togglePersonSelection(selected, "2");
    expect(personSelectionState(preview, reduced)).toBe("indeterminate");
    expect(
      personImportSelection(preview, [...reduced, "5", "6"], true, true),
    ).toEqual({
      employeeNos: ["1", "3", "4"],
      biometricConsentConfirmed: true,
    });
    expect(personSelectionState(preview, [])).toBe(false);
  });
  it("rıza yalnız seçili parmak izi ve yetki varsa görünür ve gönderilir", () => {
    expect(showFingerprintConsent(preview, ["1"], true)).toBe(true);
    expect(showFingerprintConsent(preview, ["5"], true)).toBe(false);
    expect(showFingerprintConsent(preview, ["1"], false)).toBe(false);
    expect(
      personImportSelection(preview, ["1"], false, true)
        .biometricConsentConfirmed,
    ).toBe(false);
    expect(
      personImportSelection(preview, ["1"], true, false)
        .biometricConsentConfirmed,
    ).toBe(false);
  });
});
it("sonuç metni atlanan şablonları, rızayı ve erişim kuralını içerir", () => {
  expect(
    importResultText({ ...imported, fingerprintsSkipped: 2 }, "ANKA"),
  ).toContain(
    "· 2 parmak izi atlandı · 4 rıza kaydı · Erişim kuralı: ANKA mevcut kişiler",
  );
  expect(importResultText({ ...imported, created: 0 }, "ANKA")).toContain(
    "Yeni kişi eklenmedi (hepsi zaten kayıtlı).",
  );
});

