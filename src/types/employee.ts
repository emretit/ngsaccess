import type { Id } from "../../convex/_generated/dataModel";

export interface Employee {
  _id: Id<"employees">;
  firstName: string;
  lastName: string;
  email: string;
  tcNo: string;
  cardNumber: string;
  photoUrl?: string | null;
  photoStorageId?: Id<"_storage">;
  shift?: string | null;
  companyId?: Id<"companies"> | null;
  departmentId?: Id<"departments"> | null;
  positionId?: Id<"positions"> | null;
  shiftId?: Id<"shifts"> | null;
  accessRuleId?: Id<"accessRules"> | null;
  isActive?: boolean;
  notes?: string;
  projectId?: Id<"projects">;
  createdAt?: string;
  updatedAt?: string;
  departments?: {
    _id: Id<"departments">;
    name: string;
  } | null;
  positions?: {
    _id: Id<"positions">;
    name: string;
  } | null;
}
