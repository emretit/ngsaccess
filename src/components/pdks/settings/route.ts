export const PDKS_SETTINGS_PATH = "/pdks-records/settings";

/** Kayıtlar sayfasından gelindiyse geri tuşu tarih/filtre parametreleriyle aynı görünüme döner. */
export const PDKS_SETTINGS_FROM_RECORDS = { fromRecords: true } as const;
export const cameFromRecords = (state: unknown) => typeof state === "object" && state !== null && "fromRecords" in state;
