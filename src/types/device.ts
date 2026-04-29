import type { Id } from "../../convex/_generated/dataModel";

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
  createdAt?: string;
  updatedAt?: string;
  projects?: {
    name: string;
  };
}
