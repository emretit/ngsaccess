export type HikReaderDirection = "entry" | "exit" | "both";

/** Hikvision fiziksel okuyucu index'i: kapı N için entry=2N-1, exit=2N. */
export function deriveHikReaderNoFromDoorNo(
  doorNo: number | undefined,
  direction: HikReaderDirection,
): number | undefined {
  if (doorNo === undefined) return undefined;
  return direction === "exit" ? doorNo * 2 : doorNo * 2 - 1;
}
