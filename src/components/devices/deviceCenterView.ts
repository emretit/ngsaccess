import type { DeviceOverview, getAdapter } from "./deviceAdapter";
import type { useDeviceCommands } from "./useDeviceCommands";
export type DeviceCenterView = ReturnType<typeof useDeviceCommands> & {
  overview: DeviceOverview;
  device: DeviceOverview["device"];
  adapter: ReturnType<typeof getAdapter>;
  connection: "online" | "offline" | "never";
  connected: boolean;
  offlineMessage: string;
  canManage: boolean;
  queueRows: { label: string; value: number; capped: boolean }[];
};
