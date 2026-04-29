import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Employee } from "@/types/employee";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { Id } from "../../../../convex/_generated/dataModel";

export interface EmployeeFormData {
  firstName: string;
  lastName: string;
  email: string;
  tcNo: string;
  cardNumber: string;
  companyId: string | null;
  departmentId: string | null;
  positionId: string | null;
  accessRuleId: string | null;
  shift: string | null;
  shiftId: string | null;
  photoUrl: string | null;
  notes: string;
  isActive: boolean;
  projectId?: Id<"projects">;
}

export const useEmployeeFormData = (employee?: Employee | null) => {
  const { projectIds } = useProjectAccess();
  const defaultProjectId = projectIds[0] as Id<"projects"> | undefined;

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
    shift: null,
    shiftId: null,
    photoUrl: null,
    notes: "",
    isActive: true,
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const departmentsData = useQuery(api.departments.list) ?? [];
  const companiesData = useQuery(api.companies.list) ?? [];
  const accessRulesData = useQuery(api.accessRules.list) ?? [];
  const positionsData = useQuery(api.positions.list) ?? [];

  const departments = departmentsData.map((d: { _id: string; name: string }) => ({ id: d._id, name: d.name }));
  const companies = companiesData.map((c: { _id: string; name: string }) => ({ id: c._id, name: c.name }));
  const accessRules = accessRulesData.filter((r: { isActive?: boolean }) => r.isActive !== false).map((r: { _id: string; name: string }) => ({ id: r._id, name: r.name }));
  const positions = positionsData.map((p: { _id: string; name: string }) => ({ id: p._id, name: p.name }));

  useEffect(() => {
    if (employee) {
      setFormData({
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        email: employee.email || "",
        tcNo: employee.tcNo || "",
        cardNumber: employee.cardNumber || "",
        companyId: (employee.companyId as unknown as string) ?? null,
        departmentId: (employee.departmentId as unknown as string) ?? null,
        positionId: (employee.positionId as unknown as string) ?? null,
        accessRuleId: (employee.accessRuleId as unknown as string) ?? null,
        shift: employee.shift ?? null,
        shiftId: (employee.shiftId as unknown as string) ?? null,
        photoUrl: employee.photoUrl ?? null,
        notes: employee.notes || "",
        isActive: employee.isActive ?? true,
        projectId: employee.projectId ?? defaultProjectId,
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
        shift: null,
        shiftId: null,
        photoUrl: null,
        notes: "",
        isActive: true,
        projectId: defaultProjectId,
      });
      setPhotoPreview(null);
    }
  }, [employee, defaultProjectId]);

  return {
    formData,
    setFormData,
    departments,
    companies,
    accessRules,
    positions,
    photoPreview,
    setPhotoPreview,
  };
};
