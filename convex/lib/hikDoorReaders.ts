import type { Doc } from "../_generated/dataModel";
import { deriveHikReaderNoFromDoorNo } from "./hikReaderNumbers";

type Door = Pick<Doc<"doors">, "projectId" | "deviceId" | "hikDoorNo">;
type Reader = Pick<Doc<"readers">, "projectId" | "deviceId" | "hikReaderNo" | "direction">;

/** History/live addressing, including both sides of legacy unnumbered readers. */
export function hikDoorReaderNumbers(door: Door, readers: readonly Reader[]): number[] {
  const doorNo = door.hikDoorNo ?? 1;
  const derive = (direction: Reader["direction"]) => direction === "both"
    ? [deriveHikReaderNoFromDoorNo(doorNo, "entry"), deriveHikReaderNoFromDoorNo(doorNo, "exit")]
    : [deriveHikReaderNoFromDoorNo(doorNo, direction)];
  const numbers = readers.length === 0 ? derive("both") : readers
    .filter(reader => reader.projectId === door.projectId && (!reader.deviceId || reader.deviceId === door.deviceId))
    .flatMap(reader => reader.hikReaderNo === undefined ? derive(reader.direction) : [reader.hikReaderNo]);
  return [...new Set(numbers.filter((n): n is number => n !== undefined && Number.isSafeInteger(n) && n > 0))];
}
