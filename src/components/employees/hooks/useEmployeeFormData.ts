import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Employee } from "@/types/employee";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { Id } from "../../../../convex/_generated/dataModel";

export interface EmployeeFormData {
  first_name: string;
  last_name: string;
  email: string;
  tc_no: string;
  card_number: string;
  company_id: string | null;
  department_id: string | null;
  position_id: string | null;
  access_rule_id: string | null;
  shift: string | null;
  shift_id: string | null;
  photo_url: string | null;
  notes: string;
  is_active: boolean;
  projectId?: Id<"projects">;
}

export const useEmployeeFormData = (employee?: Employee | null) => {
  const { projectIds } = useProjectAccess();
  const defaultProjectId = projectIds[0] as Id<"projects"> | undefined;

  const [formData, setFormData] = useState<EmployeeFormData>({
    first_name: "",
    last_name: "",
    email: "",
    tc_no: "",
    card_number: "",
    company_id: null,
    department_id: null,
    position_id: null,
    access_rule_id: null,
    shift: null,
    shift_id: null,
    photo_url: null,
    notes: "",
    is_active: true,
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
        first_name: (employee as Record<string, unknown>).firstName as string || employee.first_name || "",
        last_name: (employee as Record<string, unknown>).lastName as string || employee.last_name || "",
        email: employee.email || "",
        tc_no: employee.tc_no || "",
        card_number: employee.card_number || "",
        company_id: (employee.company_id as unknown as string) ?? null,
        department_id: (employee.department_id as unknown as string) ?? null,
        position_id: (employee.position_id as unknown as string) ?? null,
        access_rule_id: (employee.access_rule_id as unknown as string) ?? null,
        shift: employee.shift ?? null,
        shift_id: (employee.shift_id as unknown as string) ?? null,
        photo_url: employee.photo_url ?? null,
        notes: employee.notes || "",
        is_active: employee.is_active ?? true,
        projectId: ((employee as Record<string, unknown>).projectId as Id<"projects">) ?? defaultProjectId,
      });
      setPhotoPreview(employee.photo_url ?? null);
    } else {
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        tc_no: "",
        card_number: "",
        company_id: null,
        department_id: null,
        position_id: null,
        access_rule_id: null,
        shift: null,
        shift_id: null,
        photo_url: null,
        notes: "",
        is_active: true,
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
