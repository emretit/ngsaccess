import type { FunctionArgs } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import type { FormValues } from "./useDeviceFormSchema";

type Update = FunctionArgs<typeof api.devices.update>;
const sourceFields = {
  name: "name", deviceType: "device_type", zoneId: "zone_id", doorId: "door_id",
  doorCount: "door_count", accessDirection: "access_direction", description: "description",
  status: "status", deviceSerial: "device_serial", deviceIp: "device_ip",
  deviceUsername: "device_username", devicePassword: "device_password", brand: "brand",
  hikTransport: "hik_transport", hikModel: "hik_model", ehomeID: "ehome_id",
  ehomeKey: "ehome_key", hikDoorCount: "hik_door_count", hikPort: "hik_port",
  ideUser: "ide_user", idePassword: "ide_password", ideHttpPort: "ide_http_port",
  ideDoorCount: "ide_door_count", ideUuid: "ide_uuid",
} as const satisfies Partial<Record<keyof Update, keyof FormValues>>;

/** Compare source inputs, preserving the full payload's null/empty/transport semantics. */
export function deviceUpdatePatch(full: Update, values: FormValues, baseline: Partial<FormValues>): Update {
  const patch = { ...full };
  const transportChanged = values.brand === "hikvision" && values.hik_transport !== baseline.hik_transport;
  const required = transportChanged
    ? values.hik_transport === "localBridge"
      ? ["hikPort", "deviceUsername", "devicePassword"]
      : ["ehomeID", "ehomeKey"]
    : [];
  for (const [target, source] of Object.entries(sourceFields)) {
    // undefined sunucuda zaten atlanır; patch'te bırakmak boş mutation'ı "değişti" sayardı.
    if ((values[source] === baseline[source] && !required.includes(target)) || patch[target as keyof Update] === undefined) {
      Reflect.deleteProperty(patch, target);
    }
  }
  return patch;
}
