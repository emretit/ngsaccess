import { formatTrDateTime } from "@/lib/date";
import type { ServerDevice } from "@/types/device";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
export type DeviceOverview = NonNullable<
  FunctionReturnType<typeof api.deviceCenter.getOverview>
>;
export type OperationResult = {
  ok: boolean;
  error?: string;
  queued?: boolean;
};

export type ConfirmedAction = {
  id: string;
  title: string;
  description: string;
  destructive?: boolean;
  run: () => Promise<OperationResult>;
};

type BrandAdapter = {
  label: string;
  transport: string;
  supported: {
    capabilities: boolean;
    workStatus: boolean;
    readerCfg: boolean;
    openDoor: boolean;
    reboot: boolean;
    reconcile: boolean;
    triggerSync: boolean;
  };
  unsupportedReasons: string[];
};

export function deviceDateTime(value: string | number | undefined): string {
  if (value === undefined) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatTrDateTime(date);
}

export function formatDirection(value: string | undefined): string {
  switch (value) {
    case "entry":
      return "Giriş";
    case "exit":
      return "Çıkış";
    case "both":
      return "Çift yön";
    default:
      return "-";
  }
}

export function getAdapter(
  device: ServerDevice,
  hasIdeDoor: boolean,
): BrandAdapter {
  const brand = device.brand ?? "other";
  if (brand === "hikvision") {
    const isGateway = device.hikTransport !== "localBridge";
    const hasGatewayDevice = Boolean(device.hikDevIndex);
    const canGatewayCommand = isGateway && hasGatewayDevice;
    return {
      label: "Hikvision",
      transport:
        device.hikTransport === "localBridge" ? "Yerel köprü" : "Gateway",
      supported: {
        capabilities: canGatewayCommand,
        workStatus: canGatewayCommand,
        readerCfg: canGatewayCommand,
        openDoor: device.hikTransport === "localBridge" || canGatewayCommand,
        reboot: canGatewayCommand,
        reconcile: canGatewayCommand,
        triggerSync: false,
      },
      unsupportedReasons: [
        canGatewayCommand
          ? ""
          : "Gateway işlemleri için cihazın gateway kaydı gerekir.",
        device.hikTransport === "localBridge"
          ? "Yerel köprü bağlantısında okuyucu ayarları, özellik taraması, çalışma durumu, eşitlik kontrolü, olay tarama, kart okutma ve yeniden başlatma desteklenmiyor."
          : "",
      ].filter((item) => item.length > 0),
    };
  }

  if (brand === "ide_smart") {
    return {
      label: "IDE Smart",
      transport: "MQTT köprüsü",
      supported: {
        capabilities: false,
        workStatus: false,
        readerCfg: false,
        openDoor: Boolean(device.ideUuid) && hasIdeDoor,
        reboot: false,
        reconcile: false,
        triggerSync: Boolean(device.ideUuid),
      },
      unsupportedReasons: [
        device.ideUuid ? "" : "IDE Smart komutları için Panel UUID gerekir.",
        hasIdeDoor
          ? ""
          : "Kapı açma için panele bağlı ioId tanımlı kapı gerekir.",
      ].filter((item) => item.length > 0),
    };
  }

  return {
    label: "Genel cihaz",
    transport: "Temel kayıt",
    supported: {
      capabilities: false,
      workStatus: false,
      readerCfg: false,
      openDoor: false,
      reboot: false,
      reconcile: false,
      triggerSync: false,
    },
    unsupportedReasons: [
      "Bu marka için gelişmiş cihaz komutları henüz tanımlı değil.",
    ],
  };
}
