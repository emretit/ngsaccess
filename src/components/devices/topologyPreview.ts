import { getHikModelSpec } from "../../../convex/lib/hikModels";
import type { FormValues } from "./hooks/useDeviceFormSchema";

export function topologyPreview(values: Pick<FormValues, "brand" | "hik_model" | "hik_door_count" | "ide_door_count" | "door_count">): string {
  if (values.brand === "hikvision") {
    if (!values.hik_model) return "Model seçin";
    const spec = getHikModelSpec(values.hik_model);
    if (spec) return `${spec.doorCount} kapı · ${spec.doorCount * spec.defaultReadersPerDoor} okuyucu oluşturulacak.`;
    return `${values.hik_door_count ?? 4} kapı oluşturulacak.`;
  }
  return `${values.brand === "ide_smart" ? values.ide_door_count ?? 4 : values.door_count ?? 1} kapı oluşturulacak.`;
}
