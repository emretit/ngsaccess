import { escapeXml } from "./escapers";

/**
 * SGK Aylık Prim ve Hizmet Belgesi (APHB) eksik gün nedeni kodları.
 * MUHSGK/APHB eksik gün nedenleri; 02 ve 14 listede bulunmaz.
 */
export const SGK_EKSIK_GUN_KODU = {
  ISTIRAHAT: "01", // raporlu/sağlık
  DISIPLIN: "03",
  GOZALTI: "04",
  TUTUKLULUK: "05",
  KISMI_ISTIHDAM: "06",
  PUANTAJ_KAYDI: "07",
  GREV: "08",
  LOKAVT: "09",
  GENEL_HAYATI_ETKILEYEN_OLAYLAR: "10",
  DOGAL_AFET: "11",
  BIRDEN_FAZLA_NEDEN: "12",
  DIGER_NEDENLER: "13",
  DEVAMSIZLIK: "15",
  FESIH_TARIHINDE_CALISMAMIS: "16",
  EV_HIZMETLERINDE_30_GUNDEN_AZ: "17",
  KISA_CALISMA_ODENEGI: "18",
  UCRETSIZ_DOGUM_IZNI: "19",
  UCRETSIZ_YOL_IZNI: "20",
  DIGER_BELGELI_NEDENLER: "21",
  YARIM_CALISMA_ODENEGI: "22",
  YARIM_CALISMA_ODENEGI_VE_DIGER: "23",
  DIGER_BELGESIZ_NEDENLER: "24",
  ISCININ_VEFATI: "25",
  KISMI_ISTIHDAMA_IZINLI_YABANCI: "26",
  KISA_CALISMA_ODENEGI_VE_DIGER: "27",
  PANDEMI_UCRETSIZ_IZIN: "28",
  PANDEMI_UCRETSIZ_IZIN_VE_DIGER: "29",
} as const;

export type SgkEksikGunKodu =
  (typeof SGK_EKSIK_GUN_KODU)[keyof typeof SGK_EKSIK_GUN_KODU];

const LEAVE_TYPE_TO_CODE: Readonly<Record<string, SgkEksikGunKodu | null>> = {
  sick: SGK_EKSIK_GUN_KODU.ISTIRAHAT,
  unpaid: SGK_EKSIK_GUN_KODU.DIGER_BELGELI_NEDENLER, // dilekçeli ücretsiz izin
  parental: SGK_EKSIK_GUN_KODU.ISTIRAHAT, // SGK ödenekli analık izni
  paternity: null,
  lactation: null,
  bereavement: null,
  marriage: null,
  excuse: null,
  compensatory: null,
  annual: null,
};

export function sgkCodeForLeaveType(leaveType: string | undefined): SgkEksikGunKodu | null {
  if (!leaveType) return null;
  return LEAVE_TYPE_TO_CODE[leaveType] ?? null;
}

export function sgkCodeForAbsence(): SgkEksikGunKodu {
  return SGK_EKSIK_GUN_KODU.DEVAMSIZLIK;
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
