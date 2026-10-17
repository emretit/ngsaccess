import { departmentPath } from "../lib/departmentPath";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Employee } from "@/types/employee";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { Id } from "../../../../convex/_generated/dataModel";

export interface EmployeeFormData {
  firstName: string;
  lastName: string;
  email: string;
  tcNo: string;
  cardNumber: string;
  payrollCode: string;
  companyId: Id<"companies"> | null;
  departmentId: Id<"departments"> | null;
  positionId: Id<"positions"> | null;
  accessRuleId: Id<"accessRules"> | null;
  shift: string | null;
  shiftId: Id<"shifts"> | null;
  photoUrl: string | null;
  photoStorageId?: Id<"_storage">;
  notes: string;
  isActive: boolean;
  hourlyRate: number | null;
  monthlySalary: number | null;
  projectId?: Id<"projects">;
}

export const useEmployeeFormData = (employee?: Employee | null) => {
  const { projectId } = useActiveProjectScope();
  const [defaultProjectId] = useState(projectId);

  const [formData, setFormData] = useState<EmployeeFormData>({
    firstName: "",
    lastName: "",
    email: "",
    tcNo: "",
    cardNumber: "",
    payrollCode: "",
    companyId: null,
    departmentId: null,
    positionId: null,
    accessRuleId: null,
    shift: null,
    shiftId: null,
    photoUrl: null,
    notes: "",
    isActive: true,
    hourlyRate: null,
    monthlySalary: null,
  });

  const [initialData, setInitialData] = useState<string>();
  const resetFormData = (data: EmployeeFormData) => {
    setFormData(data);
    setInitialData(JSON.stringify(data));
  };
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const departmentsData = useQuery(
    api.departments.list,
    defaultProjectId ? { projectId: defaultProjectId } : "skip",
  );
  const companiesData = useQuery(
    api.companies.list,
    defaultProjectId ? { projectId: defaultProjectId } : "skip",
  );
  const accessRulesData = useQuery(
    api.accessRules.list,
    defaultProjectId ? { projectId: defaultProjectId } : "skip",
  );
  const positionsData = useQuery(api.positions.list);

  const optionsLoading =
    departmentsData === undefined ||
    companiesData === undefined ||
    accessRulesData === undefined ||
    positionsData === undefined;

  const departments = (departmentsData ?? []).map((d) => ({
    id: d._id,
    name: departmentPath(d._id, departmentsData ?? []),
  }));
  const companies = (companiesData ?? []).map(
    (c: { _id: string; name: string }) => ({ id: c._id, name: c.name }),
  );
  const accessRules = (accessRulesData ?? [])
    .filter((r: { isActive?: boolean }) => r.isActive !== false)
    .map((r: { _id: string; name: string }) => ({ id: r._id, name: r.name }));
  const positions = (positionsData ?? [])
    .filter((p) => p.projectId === defaultProjectId)
    .map((p: { _id: string; name: string }) => ({ id: p._id, name: p.name }));

  useEffect(() => {
    if (employee && employee.projectId === defaultProjectId) {
      resetFormData({
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        email: employee.email || "",
        tcNo: employee.tcNo || "",
        cardNumber: employee.cardNumber || "",
        payrollCode: employee.payrollCode || "",
        companyId: employee.companyId ?? null,
        departmentId: employee.departmentId ?? null,
        positionId: employee.positionId ?? null,
        accessRuleId: null,
        shift: employee.shift ?? null,
        shiftId: employee.shiftId ?? null,
        photoUrl: employee.photoUrl ?? null,
        photoStorageId: employee.photoStorageId,
        notes: employee.notes || "",
        isActive: employee.isActive ?? true,
        hourlyRate: employee.hourlyRate ?? null,
        monthlySalary: employee.monthlySalary ?? null,
        projectId: employee.projectId ?? defaultProjectId,
      });
      setPhotoPreview(employee.photoUrl ?? null);
    } else {
      resetFormData({
        firstName: "",
        lastName: "",
        email: "",
        tcNo: "",
        cardNumber: "",
        payrollCode: "",
        companyId: null,
        departmentId: null,
        positionId: null,
        accessRuleId: null,
        shift: null,
        shiftId: null,
        photoUrl: null,
        notes: "",
        isActive: true,
        hourlyRate: null,
        monthlySalary: null,
        projectId: defaultProjectId,
      });
      setPhotoPreview(null);
    }
    // Form sadece düzenlenen kişi (employee._id) değiştiğinde reset edilir.
    // employee prop'u her parent re-render'da yeni referans alabilir; tüm objeyi
    // dep'e koymak form'u sürekli resetler ve kullanıcının yazdıkları kaybolur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?._id, defaultProjectId]);

  return {
    formData,
    initialData,
    setFormData,
    departments,
    companies,
    accessRules,
    positions,
    photoPreview,
    setPhotoPreview,
    optionsLoading,
  };
};
