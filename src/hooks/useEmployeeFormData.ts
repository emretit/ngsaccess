import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import { Id } from "../../convex/_generated/dataModel";

export interface EmployeeFormData {
  firstName: string;
  lastName: string;
  email: string;
  tcNo: string;
  cardNumber: string;
  companyId: Id<"companies"> | null;
  departmentId: Id<"departments"> | null;
  positionId: Id<"positions"> | null;
  accessRuleId: Id<"accessRules"> | null;
  shiftId: Id<"shifts"> | null;
  shift: string | null;
  photoUrl: string | null;
  notes: string;
  isActive: boolean;
}

interface EmployeeInput {
  _id?: Id<"employees">;
  firstName?: string;
  lastName?: string;
  email?: string;
  tcNo?: string;
  cardNumber?: string;
  companyId?: Id<"companies"> | null;
  departmentId?: Id<"departments"> | null;
  positionId?: Id<"positions"> | null;
  accessRuleId?: Id<"accessRules"> | null;
  shiftId?: Id<"shifts"> | null;
  shift?: string | null;
  photoUrl?: string | null;
  notes?: string;
  isActive?: boolean;
}

export const useEmployeeFormData = (employee?: EmployeeInput | null) => {
  const { projectIds, isSuperAdmin } = useProjectAccess();

  const [formData, setFormData] = useState<EmployeeFormData>({
    firstName: "",
    lastName: "",
    email: "",
    tcNo: "",
    cardNumber: "",
    companyId: null,
    departmentId: null,
    positionId: null,
    accessRuleId: null,
    shiftId: null,
    shift: null,
    photoUrl: null,
    notes: "",
    isActive: true,
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setFormData({
        firstName: employee.firstName ?? "",
        lastName: employee.lastName ?? "",
        email: employee.email ?? "",
        tcNo: employee.tcNo ?? "",
        cardNumber: employee.cardNumber ?? "",
        companyId: employee.companyId ?? null,
        departmentId: employee.departmentId ?? null,
        positionId: employee.positionId ?? null,
        accessRuleId: employee.accessRuleId ?? null,
        shiftId: employee.shiftId ?? null,
        shift: employee.shift ?? null,
        photoUrl: employee.photoUrl ?? null,
        notes: employee.notes ?? "",
        isActive: employee.isActive ?? true,
      });
      setPhotoPreview(employee.photoUrl ?? null);
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        tcNo: "",
        cardNumber: "",
        companyId: null,
        departmentId: null,
        positionId: null,
        accessRuleId: null,
        shiftId: null,
        shift: null,
        photoUrl: null,
        notes: "",
        isActive: true,
      });
      setPhotoPreview(null);
    }
    // Form sadece employee._id değiştiğinde reset edilir; tüm employee prop'larını deps'e koymak gereksiz tekrar tetiklemeye yol açar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?._id]);

  const departments = useQuery(api.departments.list, projectIds.length > 0 ? {} : "skip");

  const companies = useQuery(api.companies.list, projectIds.length > 0 ? {} : "skip");

  const accessRules = useQuery(
    api.accessRules.list,
    projectIds.length > 0 ? { projectId: projectIds[0] } : {}
  );

  const positions = useQuery(api.positions.list, projectIds.length > 0 ? {} : "skip");

  return {
    formData,
    setFormData,
    departments: departments ?? [],
    companies: companies ?? [],
    accessRules: accessRules ?? [],
    positions: positions ?? [],
    photoPreview,
    setPhotoPreview,
  };
};
