import type { Id } from "../../convex/_generated/dataModel";
import type { DeviceBrand } from "@/components/devices/hooks/useDeviceFormSchema";

export type { DeviceBrand };
export type AccessDirection = "entry" | "exit" | "both";

export interface Device {
  _id: Id<"devices">;
  name: string;
  description?: string;
  deviceType?: string;
  deviceIp?: string;
  deviceSerial?: string;
  accessDirection?: AccessDirection;
  status?: "online" | "offline" | "expired" | "active" | "inactive" | string;
  isActive?: boolean;
  zoneId?: Id<"zones">;
  doorId?: Id<"doors">;
  projectId?: Id<"projects">;
  lastSeen?: string;
  deviceUsername?: string;
  devicePassword?: string;
  brand?: DeviceBrand;
  // Hik Device Gateway entegrasyonu
  hikDevIndex?: string;
  ehomeID?: string;
  ehomeKey?: string;
  hikModel?: string;
  hikLastSeenAt?: number;
  hikOfflineHint?: string;
  hikTransport?: "gateway" | "localBridge";
  hikDoorCount?: number;
  hikPort?: number;
  // IDE Smart panel
  ideUuid?: string;
  ideUser?: string;
  idePassword?: string;
  ideHttpPort?: number;
  ideDoorCount?: number;
  apiToken?: string;
  apiTokenCreatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  _id: Id<"projects">;
  name: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServerDevice {
  _id: Id<"devices">;
  name: string;
  description?: string;
  deviceType?: string;
  deviceIp?: string;
  deviceSerial?: string;
  accessDirection?: AccessDirection;
  status?: "online" | "offline" | "expired" | "active" | "inactive" | string;
  isActive?: boolean;
  zoneId?: Id<"zones">;
  doorId?: Id<"doors">;
  projectId?: Id<"projects">;
  lastSeen?: string;
  deviceUsername?: string;
  devicePassword?: string;
  brand?: DeviceBrand;
  // Hik Device Gateway entegrasyonu
  hikDevIndex?: string;
  ehomeID?: string;
  ehomeKey?: string;
  hikModel?: string;
  hikLastSeenAt?: number;
  hikOfflineHint?: string;
  hikTransport?: "gateway" | "localBridge";
  hikDoorCount?: number;
  hikPort?: number;
  // IDE Smart panel
  ideUuid?: string;
  ideUser?: string;
  idePassword?: string;
  ideHttpPort?: number;
  ideDoorCount?: number;
  apiToken?: string;
  apiTokenCreatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  projects?: {
    name: string;
  };
}
