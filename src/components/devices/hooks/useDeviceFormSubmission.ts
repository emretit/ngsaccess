import { deviceUpdatePatch } from "./deviceUpdatePatch";
import { buildDeviceFormValues, type DeviceData } from "./buildDeviceFormValues";
import { useRef, useState } from "react";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { FormValues } from "./useDeviceFormSchema";
import { NEW_ZONE_VALUE } from "../form-sections/DeviceZoneSection";
import {
  MANUAL_MODEL_ID,
  getHikModelSpec,
  resolveHikModelSpec,
} from "../../../../convex/lib/hikModels";

// localBridge SDK varsayılanları (backend hikBridge.ts ile aynı). Sayısal alan boş
// bırakılınca undefined yerine default gönderilir: update handler undefined'ı skip
// ettiği için aksi halde alan "temizlenip varsayılana" döndürülemezdi.
const HIK_DEFAULT_PORT = 8000;
const HIK_DEFAULT_DOOR_COUNT = 4;

interface UseDeviceFormSubmissionProps {
  device?: DeviceData | null;
  getBaseline?: () => Partial<FormValues>;
  currentProjectId: Id<"projects"> | null;
  onSuccess: () => void;
  /** Admin modu: yalnız bağlantı kimliği yazılır; isim seri/UUID'den türetilir, konum/yön/tip gönderilmez. */
  adminMode?: boolean;
}

export function useDeviceFormSubmission({
  device,
  currentProjectId,
  onSuccess,
  adminMode,
  getBaseline,
}: UseDeviceFormSubmissionProps) {
  const savedId = useRef<Id<"devices"> | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const createDevice = useMutation(api.devices.create);
  const updateDevice = useMutation(api.devices.update);
  const registerOnGateway = useAction(api.actions.hikGatewayDevice.registerDeviceOnGateway);
  const createIdePanel = useMutation(api.devices.createIdePanel);
  const createHikDevice = useMutation(api.devices.createHikDevice);

  const save = async (values: FormValues) => {
      if (savedId.current) {
        const reg = await registerOnGateway({ deviceId: savedId.current });
        if (!reg.ok) throw new Error(reg.error ?? "Bağlantı kurulamadı");
        setConnectionError(null);
        notify.success("Kayıtlı cihazın gateway bağlantısı hazırlandı");
        onSuccess();
        return;
      }
      // IDE Smart paneli: cihaz + kapıları tek mutation'da üret, bölgeye yerleştir, sonra bağlan.
      if (values.brand === "ide_smart" && !device?._id) {
        // Admin modu: bölge seçilmez (gizli) → backend placeholder bölge üretir; isim UUID/IP'den türetilir.
        // Proje sonradan paneli gerçek bölgeye taşır ve yeniden adlandırır.
        const pickedZone = adminMode
          ? undefined
          : values.zone_id && values.zone_id !== NEW_ZONE_VALUE
            ? (values.zone_id as Id<"zones">)
            : undefined;
        const newZoneName = adminMode
          ? undefined
          : values.zone_id === NEW_ZONE_VALUE
            ? values.new_zone_name?.trim() || undefined
            : undefined;
        const panelName = adminMode
          ? values.ide_uuid?.trim() || values.device_ip?.trim() || "Panel"
          : values.name;
        await createIdePanel({
          status: values.status,
          name: panelName,
          projectId: currentProjectId ?? undefined,
          zoneId: pickedZone,
          newZoneName,
          deviceIp: values.device_ip || undefined,
          ideUser: values.ide_user?.trim() || undefined,
          idePassword: values.ide_password?.trim() || undefined,
          ideHttpPort: values.ide_http_port || undefined,
          ideDoorCount: values.ide_door_count || undefined,
          ideUuid: values.ide_uuid?.trim() || undefined,
          description: values.description || undefined,
        });
        notify.success("Panel ve kapıları oluşturuldu");

        // Panel broker'a kendi bağlanır, UUID ile eklenir; panel ilk trigger'da
        // (heartbeat/kart) otomatik canlanır. HTTP-login adımı kullanılmaz.
        onSuccess();
        return;
      }
      // Hikvision yeni cihaz (admin değil): cihaz + kapılar (hikDoorNo 1..N) + okuyucular
      // model seçiminden tek mutation'da üretilir. Gateway ise ardından otomatik kaydolur.
      if (values.brand === "hikvision" && !device?._id && !adminMode) {
        const spec = resolveHikModelSpec(values.hik_model, values.hik_door_count);
        const modelSpec = getHikModelSpec(values.hik_model);
        const isLocalBridge = values.hik_transport === "localBridge";
        const pickedZone =
          values.zone_id && values.zone_id !== NEW_ZONE_VALUE
            ? (values.zone_id as Id<"zones">)
            : undefined;
        const newZoneName =
          values.zone_id === NEW_ZONE_VALUE
            ? values.new_zone_name?.trim() || undefined
            : undefined;
        const { deviceId: newId } = await createHikDevice({
          name: values.name,
          projectId: currentProjectId ?? undefined,
          zoneId: pickedZone,
          newZoneName,
          deviceType: modelSpec?.family === "controller"
            ? "Kapı Kontrolörü"
            : modelSpec?.family === "terminal" ? "Erişim Terminali" : undefined,
          hikTransport: values.hik_transport,
          // "Diğer (manuel)" gerçek bir model değil → hikModel boş bırakılır.
          hikModel:
            values.hik_model && values.hik_model !== MANUAL_MODEL_ID
              ? values.hik_model
              : undefined,
          hikFamily: modelSpec?.family,
          doorCount: spec.doorCount,
          readersPerDoor: spec.defaultReadersPerDoor,
          deviceIp: values.device_ip || undefined,
          deviceSerial: values.device_serial || undefined,
          deviceUsername: values.device_username || undefined,
          devicePassword: values.device_password || undefined,
          ehomeID: isLocalBridge ? undefined : values.ehome_id?.trim() || undefined,
          ehomeKey: isLocalBridge ? undefined : values.ehome_key?.trim() || undefined,
          hikPort: isLocalBridge ? values.hik_port || HIK_DEFAULT_PORT : undefined,
          accessDirection: values.access_direction as "entry" | "exit" | "both",
          status: values.status,
          description: values.description || undefined,
        });
        savedId.current = newId;

        // Gateway transport + ehome dolu → otomatik gateway registration.
        if (!isLocalBridge && values.ehome_id?.trim()) {
          const reg = await registerOnGateway({ deviceId: newId });
          if (!reg.ok) throw new Error(reg.error ?? "Gateway bağlantısı kurulamadı");
        }
        notify.success("Cihaz, kapılar ve okuyucular kaydedildi");
        onSuccess();
        return;
      }
      // localBridge ↔ gateway geçişinde RHF gizli alanları temizlemediği için transport'a
      // göre yalnız ilgili alanları gönder: aksi halde localBridge kaydında eski ehome metni
      // hem yazılır hem de aşağıdaki otomatik gateway kaydını tetikler (gateway'de de
      // alakasız hikDoorCount sızar). undefined alanlar update handler'ında skip edilir.
      const isHikLocalBridge =
        values.brand === "hikvision" && values.hik_transport === "localBridge";
      const hikFields =
        values.brand === "hikvision"
          ? {
              hikTransport: values.hik_transport,
              // Model etiketi düzenlemede kalıcı (kapı/okuyucu yeniden üretilmez). "manuel" → boş.
              hikModel:
                values.hik_model && values.hik_model !== MANUAL_MODEL_ID
                  ? values.hik_model
                  : device?._id ? null : undefined,
              ehomeID: isHikLocalBridge ? undefined : values.ehome_id?.trim() || undefined,
              ehomeKey: isHikLocalBridge ? undefined : values.ehome_key?.trim() || undefined,
              hikDoorCount: isHikLocalBridge && !device?._id
                ? values.hik_door_count || HIK_DEFAULT_DOOR_COUNT
                : undefined,
              hikPort: isHikLocalBridge ? values.hik_port || HIK_DEFAULT_PORT : undefined,
            }
          : {};
      const ideFields =
        values.brand === "ide_smart"
          ? {
              ideUser: values.ide_user?.trim() || undefined,
              idePassword: values.ide_password?.trim() || undefined,
              ideHttpPort: values.ide_http_port || undefined,
              ideDoorCount: device?._id ? undefined : values.ide_door_count || undefined,
              ideUuid: values.ide_uuid?.trim() || undefined,
            }
          : {};
      // Admin modu yalnız bağlantı kimliğini yazar; isim/bölge/kapı/yön/tip/durum
      // proje tarafının kararıdır → bu alanlar gönderilmez (update'te de korunur).
      const connectionFields = {
        deviceSerial: values.device_serial || undefined,
        deviceIp: values.device_ip || (device?._id ? null : undefined),
        // localBridge'de boş string'i koru: update handler undefined alanları skip eder,
        // bu yüzden "" göndermezsek panel kullanıcı/şifresi temizlenemezdi. Bu alanlar
        // yalnız localBridge bölümünde render edilir → diğer markalarda eski davranış.
        deviceUsername: isHikLocalBridge
          ? (values.device_username ?? "").trim()
          : values.device_username || undefined,
        devicePassword: isHikLocalBridge
          ? (values.device_password ?? "")
          : values.device_password || undefined,
        brand: values.brand,
        ...hikFields,
        ...ideFields,
      };
      let deviceId: Id<"devices"> | undefined;
      // Yalnız düzenlemede false olabilir: değişen alan yoksa update atlanır, gateway kaydı yine denenir.
      let changed = true;
      if (device?._id) {
        const fullUpdate = (
          adminMode
            ? { deviceId: device._id, ...connectionFields }
            : {
                deviceId: device._id,
                name: values.name,
                deviceType: values.brand === "hikvision" ? values.device_type || undefined : values.device_type,
                zoneId: (values.zone_id || undefined) as Id<"zones"> | undefined,
                doorId: (values.door_id || undefined) as Id<"doors"> | undefined,
                doorCount: device?._id ? undefined : values.door_count || undefined,
                accessDirection: values.access_direction as "entry" | "exit" | "both",
                description: values.description || null,
                status: values.status,
                ...connectionFields,
              }
        );
        const patch = deviceUpdatePatch(fullUpdate, values, getBaseline?.() ?? buildDeviceFormValues(device));
        changed = Object.keys(patch).length > 1;
        if (changed) await updateDevice(patch);
        deviceId = device._id;
      } else {
        deviceId = await createDevice(
          adminMode
            ? {
                name: values.device_serial?.trim() || "Cihaz",
                projectId: currentProjectId ?? undefined,
                deviceSerial: values.device_serial || undefined,
                deviceIp: values.device_ip || undefined,
                deviceUsername: values.device_username || undefined,
                devicePassword: values.device_password || undefined,
                brand: values.brand,
                ...hikFields,
                hikModel: hikFields.hikModel ?? undefined,
              }
            : {
                name: values.name,
                deviceSerial: values.device_serial || undefined,
                deviceType: values.device_type,
                projectId: currentProjectId ?? undefined,
                zoneId:
                  values.zone_id && values.zone_id !== NEW_ZONE_VALUE
                    ? (values.zone_id as Id<"zones">)
                    : undefined,
                newZoneName:
                  values.zone_id === NEW_ZONE_VALUE
                    ? values.new_zone_name?.trim() || undefined
                    : undefined,
                doorId: (values.door_id || undefined) as Id<"doors"> | undefined,
                doorCount: values.door_count || undefined,
                accessDirection: values.access_direction as "entry" | "exit" | "both",
                deviceIp: values.device_ip || undefined,
                deviceUsername: values.device_username || undefined,
                devicePassword: values.device_password || undefined,
                description: values.description || undefined,
                status: values.status,
                brand: values.brand,
                ...hikFields,
                hikModel: hikFields.hikModel ?? undefined,
              }
        );
        savedId.current = deviceId;
      }

      // Hikvision cihazlar için otomatik gateway registration (zaten kayıtlıysa skip).
      const alreadyRegistered = !!device?.hikDevIndex;
      if (
        values.brand === "hikvision" &&
        values.hik_transport !== "localBridge" &&
        deviceId &&
        values.ehome_id?.trim() &&
        !alreadyRegistered
      ) {
        const reg = await registerOnGateway({ deviceId });
        if (!reg.ok) throw new Error(reg.error ?? "Gateway bağlantısı kurulamadı");
        if (!changed) {
          notify.success("Cihazın gateway bağlantısı hazırlandı");
          onSuccess();
          return;
        }
      }
      if (changed) notify.success("Cihaz bilgileri kaydedildi");
      else notify.info("Kaydedilecek değişiklik yok");
      onSuccess();
  };
  const { run, pending: isLoading } = useAsyncAction(async (values: FormValues) => {
    try { await save(values); }
    catch (error: unknown) {
      if (savedId.current) setConnectionError(`Cihaz kaydedildi (${savedId.current}). Bağlantı kurulamadı; tekrar deneme aynı cihazı kullanır.`);
      throw error;
    }
  }, { error: "Cihaz kaydı veya bağlantı işlemi tamamlanamadı" });
  const onSubmit = async (values: FormValues) => { await run(values); };
  return { isLoading, onSubmit, connectionError };
}
