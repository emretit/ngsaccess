import { Id } from "../../../../convex/_generated/dataModel";
import { FormValues, type DeviceBrand } from "./useDeviceFormSchema";

type AccessDirection = "entry" | "exit" | "both";

/** buildDeviceFormValues'ın okuduğu cihaz alanları (ServerDevice ile yapısal uyumlu). */
export interface DeviceData {
  _id?: Id<"devices">;
  name?: string;
  deviceSerial?: string;
  deviceType?: string;
  zoneId?: Id<"zones">;
  doorId?: Id<"doors">;
  doorCount?: number;
  accessDirection?: AccessDirection;
  deviceIp?: string;
  deviceUsername?: string;
  devicePassword?: string;
  description?: string;
  status?: string;
  brand?: DeviceBrand;
  ehomeID?: string;
  ehomeKey?: string;
  hikDevIndex?: string;
  hikTransport?: "gateway" | "localBridge";
  hikModel?: string;
  hikDoorCount?: number;
  hikPort?: number;
  ideUuid?: string;
  ideUser?: string;
  idePassword?: string;
  ideHttpPort?: number;
  ideDoorCount?: number;
}

/**
 * Cihaz formunun değerlerini üretir. "Yeni Cihaz" ve "Düzenle" TEK formdur; tek fark
 * verinin dolu gelmesidir. react-hook-form'un `values` API'siyle kullanılır
 * (useForm({ values })): device değişince form otomatik + deterministik senkronlanır —
 * eski `form.reset`-in-`useEffect` yaklaşımındaki mount/brand yarışı (Select'lerin boş
 * gelmesi) burada hiç oluşmaz, çünkü değerler ilk render'dan itibaren forma bağlıdır.
 *
 * device yoksa "Yeni Cihaz" default'ları döner (defaultBrand + IDE ön-tanımlı kimliği).
 */
export function buildDeviceFormValues(
  device: DeviceData | null | undefined,
  defaultBrand?: DeviceBrand,
): FormValues {
  if (!device) {
    return {
      brand: defaultBrand ?? "other",
      name: "",
      device_serial: "",
      device_type: "Kart Okuyucu",
      zone_id: undefined,
      door_id: undefined,
      door_count: undefined,
      access_direction: "both",
      device_ip: "",
      device_username: "",
      device_password: "",
      description: "",
      status: "active",
      ehome_id: "",
      ehome_key: "",
      hik_transport: "gateway",
      hik_model: undefined,
      hik_door_count: undefined,
      hik_port: undefined,
      ide_uuid: "",
      // IDE Smart paneli ön-tanımlı kimliği (MQTT login token'ı için).
      ide_user: "admin",
      ide_password: "admin12345",
      ide_http_port: undefined,
      ide_door_count: undefined,
    };
  }

  return {
    brand: device.brand ?? "other",
    name: device.name ?? "",
    device_serial: device.deviceSerial ?? "",
    device_type: (device.deviceType ?? "Kart Okuyucu") as FormValues["device_type"],
    zone_id: device.zoneId as string | undefined,
    door_id: device.doorId as string | undefined,
    door_count: device.doorCount,
    access_direction: (device.accessDirection ?? "both") as AccessDirection,
    device_ip: device.deviceIp ?? "",
    device_username: device.deviceUsername ?? "",
    device_password: device.devicePassword ?? "",
    description: device.description ?? "",
    status: (device.status === "active" || device.status === "inactive"
      ? device.status
      : "active") as "active" | "inactive",
    ehome_id: device.ehomeID ?? "",
    ehome_key: device.ehomeKey ?? "",
    // Kayıtlı transport'u olduğu gibi yükle. Eski gateway cihazlarında (hikTransport alanı
    // eklenmeden önce oluşturulmuş) bu alan boştur; ama ehomeID/hikDevIndex doluysa cihaz
    // gateway ile kayıtlıdır → gateway varsay ki dropdown + ehome alanları görünsün. Hiçbir
    // sinyali olmayan cihaz "Seçin"de kalır (zorla gateway'e düşürmek yanıltıcı olurdu).
    hik_transport:
      device.hikTransport ??
      (device.ehomeID || device.hikDevIndex ? "gateway" : undefined),
    hik_model: device.hikModel ?? undefined,
    hik_door_count: device.hikDoorCount,
    hik_port: device.hikPort,
    ide_uuid: device.ideUuid ?? "",
    ide_user: device.ideUser ?? "",
    ide_password: device.idePassword ?? "",
    ide_http_port: device.ideHttpPort,
    ide_door_count: device.ideDoorCount,
  };
}
