import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";

export type DeviceImportPreview = FunctionReturnType<
  typeof api.actions.hikDeviceImport.previewDeviceImport
>;
export type DeviceImportResult = FunctionReturnType<
  typeof api.actions.hikDeviceImport.importDevicePersons
>;
export function selectablePersons(preview: DeviceImportPreview | null) {
  return preview?.rows.filter((row) => row.status === "new") ?? [];
}
export function defaultPersonSelection(preview: DeviceImportPreview) {
  return selectablePersons(preview).map((row) => row.employeeNo);
}
export function selectedPersons(
  preview: DeviceImportPreview | null,
  selected: string[],
) {
  return selectablePersons(preview).filter((row) =>
    selected.includes(row.employeeNo),
  );
}
export function personSelectionState(
  preview: DeviceImportPreview | null,
  selected: string[],
): boolean | "indeterminate" {
  const count = selectedPersons(preview, selected).length;
  return count === 0
    ? false
    : count === selectablePersons(preview).length
      ? true
      : "indeterminate";
}
export function togglePersonSelection(selected: string[], employeeNo: string) {
  return selected.includes(employeeNo)
    ? selected.filter((no) => no !== employeeNo)
    : [...selected, employeeNo];
}
export function showFingerprintConsent(
  preview: DeviceImportPreview | null,
  selected: string[],
  canBiometrics: boolean,
) {
  return (
    canBiometrics &&
    selectedPersons(preview, selected).some((row) => row.fingerCount > 0)
  );
}
export function personImportSelection(
  preview: DeviceImportPreview | null,
  selected: string[],
  canBiometrics: boolean,
  consent: boolean,
) {
  return {
    employeeNos: selectedPersons(preview, selected).map(
      (row) => row.employeeNo,
    ),
    biometricConsentConfirmed:
      showFingerprintConsent(preview, selected, canBiometrics) && consent,
  };
}
export function importResultText(
  result: DeviceImportResult,
  deviceName: string,
) {
  const summary =
    result.created === 0
      ? "Yeni kişi eklenmedi (hepsi zaten kayıtlı)."
      : `${result.created} kişi eklendi · ${result.fingerprintsStored} parmak izi kaydedildi`;
  return (
    summary +
    (result.fingerprintsSkipped > 0
      ? ` · ${result.fingerprintsSkipped} parmak izi atlandı`
      : "") +
    (result.consentsRecorded > 0
      ? ` · ${result.consentsRecorded} rıza kaydı`
      : "") +
    (result.ruleId ? ` · Erişim kuralı: ${deviceName} mevcut kişiler` : "")
  );
}

export function isPersonImportDevice(device: { brand?: string; hikTransport?: string; hikDevIndex?: string }) {
  return device.brand === "hikvision" && device.hikTransport === "gateway" && Boolean(device.hikDevIndex);
}
