export const PDKS_SETTINGS_PATH = "/pdks-records/settings";

/** Vardiya planından gelindiyse geri tuşu aynı sekmeye döner. */
export const PDKS_SETTINGS_FROM_SHIFT_PLAN = { fromShiftPlan: true } as const;
export const cameFromShiftPlan = (state: unknown) => typeof state === "object" && state !== null && "fromShiftPlan" in state && state.fromShiftPlan === true;
