/**
 * SGK Aylık Prim ve Hizmet Belgesi (APHB) eksik gün nedeni kodları.
 * Kaynak: SGK 2008/85 sayılı Genelge.
 */
export const SGK_EKSIK_GUN_KODU = {
  ISTIRAHAT: "01", // raporlu/sağlık
  UCRETSIZ_IZIN: "02",
  DISIPLIN: "03",
  GOZALTI: "04",
  TUTUKLULUK: "05",
  KISMI_ISTIHDAM: "06",
  PUANTAJ_KAYDI: "07",
  DEVAMSIZLIK: "08",
  IS_KAZASI: "09",
  DOGUM_IZNI: "10",
  ASKERLIK: "11",
  IS_AKDI_ASKIDA: "12",
  OTHER: "21",
} as const;

export type SgkEksikGunKodu =
  (typeof SGK_EKSIK_GUN_KODU)[keyof typeof SGK_EKSIK_GUN_KODU];

const LEAVE_TYPE_TO_CODE: Record<string, SgkEksikGunKodu> = {
  sick: SGK_EKSIK_GUN_KODU.ISTIRAHAT,
  unpaid: SGK_EKSIK_GUN_KODU.UCRETSIZ_IZIN,
  parental: SGK_EKSIK_GUN_KODU.DOGUM_IZNI,
  paternity: SGK_EKSIK_GUN_KODU.DOGUM_IZNI,
  lactation: SGK_EKSIK_GUN_KODU.DOGUM_IZNI,
  bereavement: SGK_EKSIK_GUN_KODU.OTHER,
  marriage: SGK_EKSIK_GUN_KODU.OTHER,
  excuse: SGK_EKSIK_GUN_KODU.OTHER,
  compensatory: SGK_EKSIK_GUN_KODU.OTHER,
  annual: SGK_EKSIK_GUN_KODU.OTHER,
};

export function sgkCodeForLeaveType(leaveType: string | undefined): SgkEksikGunKodu | null {
  if (!leaveType) return null;
  return LEAVE_TYPE_TO_CODE[leaveType] ?? null;
}

export function sgkCodeForAbsence(): SgkEksikGunKodu {
  return SGK_EKSIK_GUN_KODU.DEVAMSIZLIK;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface AphbEmployeeEntry {
  tcKimlikNo: string;
  adSoyad: string;
  cumulativeWorkdays: number;
  totalOvertimeHours: number;
  eksikGunSayisi: number;
  eksikGunNedeni: SgkEksikGunKodu | null;
}

export interface AphbDocumentInput {
  year: number;
  month: number;
  companyName: string;
  sgkSicilNo?: string;
  employees: AphbEmployeeEntry[];
}

/**
 * Basit/illustratif APHB XML çıktısı. Resmi formata göre detaylandırmak
 * gerekebilir (e-bildirge XSD). Bu sürüm muhasebenin Excel'e atması veya
 * incelemesi için yeterli yapısal bilgi içerir.
 */
export function buildAphbXml(input: AphbDocumentInput): string {
  const headerParts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<aphb year="${input.year}" month="${input.month}">`,
    `  <isveren>`,
    `    <unvan>${escapeXml(input.companyName)}</unvan>`,
  ];
  if (input.sgkSicilNo) {
    headerParts.push(`    <sgkSicilNo>${escapeXml(input.sgkSicilNo)}</sgkSicilNo>`);
  }
  headerParts.push(`  </isveren>`, `  <calisanlar>`);

  for (const e of input.employees) {
    headerParts.push(
      `    <calisan>`,
      `      <tcKimlikNo>${escapeXml(e.tcKimlikNo)}</tcKimlikNo>`,
      `      <adSoyad>${escapeXml(e.adSoyad)}</adSoyad>`,
      `      <calismaGunu>${e.cumulativeWorkdays}</calismaGunu>`,
      `      <fazlaMesaiSaati>${e.totalOvertimeHours.toFixed(1)}</fazlaMesaiSaati>`,
      `      <eksikGunSayisi>${e.eksikGunSayisi}</eksikGunSayisi>`,
      e.eksikGunNedeni
        ? `      <eksikGunNedeni>${e.eksikGunNedeni}</eksikGunNedeni>`
        : `      <eksikGunNedeni />`,
      `    </calisan>`,
    );
  }

  headerParts.push(`  </calisanlar>`, `</aphb>`);
  return headerParts.join("\n");
}
