import type { Id } from "../../convex/_generated/dataModel";

export interface CardReading {
  _id: Id<"cardReadings">;
  cardNo: string;
  accessStatus?: "izin_verildi" | "reddedildi";
  accessTime: string;
  direction?: "entry" | "exit";
  employeeId?: Id<"employees"> | null;
  employeeName?: string | null;
  deviceId?: Id<"devices">;
  rawData?: string;
  createdAt?: string;
  updatedAt?: string;
  employees?: {
    departments?: {
      name: string;
    } | null;
  } | null;
  devices?: {
    name: string;
    deviceSerial?: string;
  } | null;
}

export interface Zone {
  _id: Id<"zones">;
  name: string;
  description?: string;
  projectId?: Id<"projects">;
  createdAt?: string;
  updatedAt?: string;
}

export interface Door {
  _id: Id<"doors">;
  name: string;
  zoneId?: Id<"zones">;
  doorCode?: string;
  location?: string;
  status?: string;
  projectId?: Id<"projects">;
  createdAt?: string;
  updatedAt?: string;
}

export interface GroupMember {
  _id: Id<"groupMembers">;
  groupId: Id<"accessRules">;
  employeeId: Id<"employees">;
  projectId?: Id<"projects">;
  createdAt?: string;
  employees?: {
    id: Id<"employees">;
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null;
}

export interface GroupDevice {
  _id: Id<"groupDevices">;
  groupId: Id<"accessRules">;
  deviceId: Id<"devices">;
  projectId?: Id<"projects">;
  createdAt?: string;
  devices?: {
    id: Id<"devices">;
    name: string;
    deviceSerial?: string;
    zoneId?: Id<"zones">;
    doorId?: Id<"doors">;
  } | null;
}

export interface AccessRule {
  _id: Id<"accessRules">;
  name: string;
  description?: string;
  targetType?: string;
  startTime?: string;
  endTime?: string;
  days?: string[];
  accessDirection?: "entry" | "exit" | "both" | string;
  priority?: number;
  isActive?: boolean;
  isTemplate?: boolean;
  templateName?: string;
  projectId?: Id<"projects">;
  hikWeekPlanNo?: number;
  createdAt?: string;
  updatedAt?: string;
  groupMembers?: GroupMember[];
  groupDevices?: GroupDevice[];
}

export interface CreateRuleInput {
  name: string;
  description?: string;
  targetType?: string;
  startTime?: string;
  endTime?: string;
  days?: string[];
  accessDirection?: string;
  priority?: number;
  isActive?: boolean;
  projectId?: Id<"projects">;
}

export interface RuleConflict {
  _id: string;
  ruleId1?: Id<"accessRules">;
  ruleId2?: Id<"accessRules">;
  conflictType?: string;
  conflictDescription?: string;
  severity?: "low" | "medium" | "high";
  resolved?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RuleTemplate {
  _id: string;
  name: string;
  description?: string;
  templateData?: unknown;
  category?: string;
  isSystemTemplate?: boolean;
  usageCount?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}
