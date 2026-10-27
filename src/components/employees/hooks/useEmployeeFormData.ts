import { usePermissions } from "@/hooks/usePermissions";
import { departmentPath } from "../lib/departmentPath";
import { useState, useEffect, type RefObject } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
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
  accessStartsAt?: string;
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

export function employeeFormValues(employee?: Employee | null, projectId?: Id<"projects">): EmployeeFormData {
  return {
    firstName: employee?.firstName || "",
    lastName: employee?.lastName || "",
    email: employee?.email || "",
    tcNo: employee?.tcNo || "",
    cardNumber: employee?.cardNumber || "",
    payrollCode: employee?.payrollCode || "",
    accessStartsAt: employee?.accessStartsAt ? new Date(Date.parse(employee.accessStartsAt) + 3 * 3600000).toISOString().slice(0, 10) : "",
    companyId: employee?.companyId ?? null,
    departmentId: employee?.departmentId ?? null,
    positionId: employee?.positionId ?? null,
    accessRuleId: null,
    shift: employee?.shift ?? null,
    shiftId: employee?.shiftId ?? null,
    photoUrl: employee?.photoUrl ?? null,
    photoStorageId: employee?.photoStorageId,
    notes: employee?.notes || "",
    isActive: employee?.isActive ?? true,
    hourlyRate: employee?.hourlyRate ?? null,
    monthlySalary: employee?.monthlySalary ?? null,
    projectId: employee?.projectId ?? projectId,
  };
}

export interface EmployeeFormDraft {
  formData: EmployeeFormData;
  initialData?: string;
  photoPreview: string | null;
  source: { identity: string; signature: string };
}
interface FormDataOptions {
  saving?: boolean;
  saved?: boolean;
  draft?: RefObject<EmployeeFormDraft | undefined>;
}
export const useEmployeeFormData = (employee?: Employee | null, { saving = false, saved = false, draft }: FormDataOptions = {}) => {
  const { projectId } = useActiveProjectScope();
  const { can } = usePermissions();
  const [defaultProjectId] = useState(projectId);

  const identity = `${defaultProjectId ?? ""}/${employee?._id ?? "new"}`;
  // The drawer retains this snapshot when a local query error unmounts the form.
  const cached = draft?.current?.source.identity === identity ? draft.current : undefined;
  const [formData, setFormData] = useState<EmployeeFormData>(() => cached?.formData ?? employeeFormValues(employee, defaultProjectId));
  const [initialData, setInitialData] = useState<string | undefined>(() => cached?.initialData ?? JSON.stringify(employeeFormValues(employee, defaultProjectId)));

  const resetFormData = (data: EmployeeFormData) => {
    setFormData(data);
    setInitialData(JSON.stringify(data));
  };
  const [photoPreview, setPhotoPreview] = useState<string | null>(() => cached ? cached.photoPreview : employee?.photoUrl ?? null);

  const departmentsData = useQuery(
    api.departments.list,
    defaultProjectId ? { projectId: defaultProjectId } : "skip",
  );
  const companiesData = useQuery(
    api.companies.list,
    defaultProjectId ? { projectId: defaultProjectId } : "skip",
  );
  const accessRulesData: FunctionReturnType<typeof api.accessRules.listMemberships> | undefined = useQuery(
    api.accessRules.listMemberships,
    defaultProjectId && can("employees.manage") ? { projectId: defaultProjectId } : "skip",
  );
  // Parametresiz çağrı eski Convex sürümüyle de çalışır; proje istemcide süzülür.
  const positionsData = useQuery(api.positions.list, defaultProjectId ? {} : "skip");

  const optionsLoading =
    departmentsData === undefined ||
    companiesData === undefined ||
    (can("employees.manage") && accessRulesData === undefined) ||
    positionsData === undefined;

  const departments = (departmentsData ?? []).map((d) => ({
    id: d._id,
    name: departmentPath(d._id, departmentsData ?? []),
    companyId: d.companyId,
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

  const incoming = JSON.stringify(employeeFormValues(employee, defaultProjectId));
  const [source, setSource] = useState(() => cached?.source ?? { identity, signature: incoming });
  const remoteChanged = source.identity === identity && source.signature !== incoming;
  const reloadLatest = () => {
    const values = employeeFormValues(employee, defaultProjectId);
    resetFormData(values);
    setPhotoPreview(values.photoUrl);
    setSource({ identity, signature: incoming });
  };
  useEffect(() => {
    if (saving) return;
    if (source.identity !== identity || initialData === undefined ||
      (source.signature !== incoming && (saved || JSON.stringify(formData) === initialData))) {
      reloadLatest();
    }
    // Compare serialized field contents, never the reactive object's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, incoming, saving, saved, initialData, formData, source]);

  useEffect(() => {
    if (draft) draft.current = { formData, initialData, photoPreview, source };
  }, [draft, formData, initialData, photoPreview, source]);

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
    remoteChanged: remoteChanged && JSON.stringify(formData) !== initialData && !saving && !saved,
    reloadLatest,
  };
};
