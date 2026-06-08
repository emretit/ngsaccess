/**
 * Cihazın kullanıcıya gösterilecek adı. IDE Smart panellerinin adı DB'de UUID
 * (örn "289833329732592") olabiliyor; bunu "IDE Smart" olarak gösteririz. Birden
 * fazla panel olduğunda UUID son-4 ile ayrılır ("IDE Smart · 2592"). DB'deki
 * device.name değişmez; bu yalnızca görünüm katmanı.
 */
export function deviceDisplayName(device: {
  name: string;
  brand?: string;
  ideUuid?: string;
}): string {
  if (device.brand === "ide_smart") {
    const suffix = device.ideUuid ? ` · ${device.ideUuid.slice(-4)}` : "";
    return `IDE Smart${suffix}`;
  }
  return device.name;
}
