import { usePermissions } from "@/hooks/usePermissions";
import { errorMessage } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { Employee } from "@/types/employee";
import { EmployeeFormData } from "./useEmployeeFormData";
import { employeeFormSchema } from "./useEmployeeFormSchema";

import type { Id } from "../../../../convex/_generated/dataModel";
import type { FunctionArgs } from "convex/server";

type UpdateArgs = FunctionArgs<typeof api.employees.update>;
const DIFFABLE = ["projectId", "firstName", "lastName", "email", "tcNo", "cardNumber", "payrollCode", "companyId", "departmentId", "positionId", "shiftId", "shift", "notes", "isActive", "hourlyRate", "monthlySalary"] as const satisfies readonly (keyof EmployeeFormData & keyof UpdateArgs)[];

/**
 * Düzenlemede yalnız kullanıcının taslakta değiştirdiği alanlar gönderilir: form açıkken başka yerde
 * yapılan değişiklik (ör. aynı drawer'da "Geri al" ile isActive) eski taslak değeriyle ezilmez.
 */
export function onlyChangedFields(args: UpdateArgs, formData: EmployeeFormData, baseline?: string): UpdateArgs {
  if (!baseline) return args;
  const parsed: unknown = JSON.parse(baseline);
  if (typeof parsed !== "object" || parsed === null) return args;
  const base = parsed as Record<string, unknown>;
  const same = (key: keyof EmployeeFormData) =>
    JSON.stringify(formData[key] ?? null) === JSON.stringify(base[key] ?? null);
  const result: UpdateArgs = { ...args };
  for (const key of DIFFABLE) if (same(key)) delete result[key];
  if (same("photoUrl") && same("photoStorageId")) {
    delete result.photoUrl;
    delete result.photoStorageId;
  }
  return result;
}

export type EmployeeSaveResult = { employeeId: Id<"employees"> };
export type { EmployeeFormData };

export const useEmployeeFormSubmit = (
  employee: Pick<Employee, "_id"> | null | undefined,
  _onClose: () => void,
  _onSave: (payload: EmployeeSaveResult) => void,
  onFieldError?: (key: string, message: string) => void,
) => {
  const { can } = usePermissions();
  const [savedResult, setSavedResult] = useState<EmployeeSaveResult>();
  const [stages, setStages] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string>();
  const append = (message: string) =>
    setStages((previous) => [...previous, message]);
  const createEmployee = useMutation(api.employees.create);
  const updateEmployee = useMutation(api.employees.update);
  const sendSetupEmail = useAction(
    api.actions.sendEmail.sendEmployeeSetupEmail,
  );
  const syncToDevices = useAction(
    api.actions.hikvisionSync.syncEmployeeToDevices,
  );

  // Form gönderildiği anda employee._id'yi snapshot al — sheet kapanırken
  // parent state temizlenirse closure'daki employee null olabilir.
  const editingId = employee?._id;

  const { run: handleSubmit, pending: isLoading } = useAsyncAction(
    async (formData: EmployeeFormData, baseline?: string) => {
      const parsed = employeeFormSchema.safeParse(formData);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0];
        setServerError(firstError?.message ?? "Form bilgileri geçersiz");
        return;
      }

      const trimmedTcNo = parsed.data.tcNo?.trim() ?? "";

      const sharedPayload = {
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
        email: parsed.data.email.trim().toLowerCase(),
        tcNo: trimmedTcNo || undefined,
        cardNumber: parsed.data.cardNumber.trim(),
        payrollCode: parsed.data.payrollCode?.trim() || undefined,
        companyId: formData.companyId ?? undefined,
        departmentId: formData.departmentId ?? undefined,
        positionId: formData.positionId ?? undefined,
        accessRuleId: formData.accessRuleId ?? undefined,
        shiftId: formData.shiftId ?? undefined,
        shift: formData.shift ?? undefined,
        photoUrl: formData.photoUrl ?? undefined,
        photoStorageId: formData.photoStorageId,
        notes: formData.notes?.trim() ?? undefined,
        isActive: formData.isActive ?? true,
        ...(can("pay.view") ? { hourlyRate: formData.hourlyRate ?? undefined, monthlySalary: formData.monthlySalary ?? undefined } : {}),
      };

      setServerError(undefined);
      let savedId = editingId;
      try {
        if (editingId) {
          await updateEmployee(onlyChangedFields({
            employeeId: editingId,
            projectId: formData.projectId,
            ...sharedPayload,
            tcNo: trimmedTcNo || null,
            payrollCode: parsed.data.payrollCode?.trim() || null,
            companyId: formData.companyId,
            departmentId: formData.departmentId,
            positionId: formData.positionId,
            shiftId: formData.shiftId,
            shift: formData.shift || null,
            photoUrl: formData.photoUrl,
            notes: formData.notes.trim() || null,
            ...(can("pay.view") ? { hourlyRate: parsed.data.hourlyRate ?? null, monthlySalary: parsed.data.monthlySalary ?? null } : {}),
          }, formData, baseline));
        } else
          savedId = await createEmployee({
            projectId: formData.projectId,
            ...sharedPayload,
          });
      } catch (error: unknown) {
        const message = errorMessage(error);
        const lower = message.toLocaleLowerCase("tr");
        const key = lower.includes("kart")
          ? "cardNumber"
          : lower.includes("posta") || lower.includes("email")
            ? "email"
            : lower.includes("kimlik") || lower.includes("tc")
              ? "tcNo"
              : undefined;
        if (key) onFieldError?.(key, message);
        else setServerError(message);
        throw error;
      }
      append("Personel kaydedildi.");
      if (!savedId) return;
      setSavedResult({ employeeId: savedId });
      if (!editingId) {
        try {
          const result = await sendSetupEmail({
            employeeId: savedId,
            email: sharedPayload.email,
            firstName: sharedPayload.firstName,
            lastName: sharedPayload.lastName,
            projectId: formData.projectId,
          });
          append(
            result.success
              ? "Kurulum e-postası gönderildi."
              : "Kurulum e-postası gönderilemedi.",
          );
        } catch {
          append("Kurulum e-postası gönderilemedi.");
        }
      }
      try {
        const result = await syncToDevices({ employeeId: savedId });
        append(
          `Cihaz gönderimi: ${result.synced} başarılı, ${result.failed} başarısız. Cihaz teslimi henüz doğrulanmadı.`,
        );
        for (const error of result.errors) append(errorMessage(error));
      } catch (error: unknown) {
        append(
          `Cihaz gönderimi tamamlanamadı: ${errorMessage(error)}`,
        );
      }
    },
    { error: "Personel kaydedilemedi" },
  );
  return { isLoading, handleSubmit, stages, serverError, savedResult };
};
