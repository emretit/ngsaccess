export function deviceBrandLabel(brand: string | undefined | null): string {
  switch (brand) {
    case "hikvision":
      return "Hikvision";
    case "ide_smart":
      return "IDE Smart";
    default:
      return "Diğer";
  }
}
