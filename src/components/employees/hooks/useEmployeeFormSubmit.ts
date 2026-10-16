import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/lib/notify";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "@/hooks/use-toast";
import { Employee } from "@/types/employee";
import { EmployeeFormData } from "./useEmployeeFormData";
import { employeeFormSchema } from "./useEmployeeFormSchema";

export type { EmployeeFormData };

const reportSyncResult = (
  synced: number,
  failed: number,
  errors: string[] = [],
) => {
  if (synced > 0) {
    toast({
      variant: "success",
      title: "Cihaz Senkronizasyonu",
      description: `${synced} cihaza senkronize edildi`,
    });
  }
  if (failed > 0) {
    const detail = errors.length > 0
      ? errors.join(" • ")
      : `${failed} cihaza gönderilemedi`;
    toast({
      title: `${failed} cihaza gönderilemedi`,
      description: detail,
      variant: "destructive",
    });
  }
};

export const useEmployeeFormSubmit = (
  employee: Pick<Employee, "_id"> | null | undefined,
  onClose: () => void,
  onSave: (payload?: unknown) => void
) => {


  const createEmployee = useMutation(api.employees.create);
  const updateEmployee = useMutation(api.employees.update);
  const sendSetupEmail = useAction(api.actions.sendEmail.sendEmployeeSetupEmail);
  const syncToDevices = useAction(api.actions.hikvisionSync.syncEmployeeToDevices);

  // Form gönderildiği anda employee._id'yi snapshot al — sheet kapanırken
  // parent state temizlenirse closure'daki employee null olabilir.
  const editingId = employee?._id;

  const { run: handleSubmit, pending: isLoading } = useAsyncAction(async (formData: EmployeeFormData) => {
      const parsed = employeeFormSchema.safeParse(formData);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0];
        toast({
          title: "Hata",
          description: firstError?.message ?? "Form bilgileri geçersiz",
          variant: "destructive",
        });
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
        hourlyRate: formData.hourlyRate ?? undefined,
        monthlySalary: formData.monthlySalary ?? undefined,
      };

      if (editingId) {
        // Update
        await updateEmployee({
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
          hourlyRate: parsed.data.hourlyRate ?? null,
          monthlySalary: parsed.data.monthlySalary ?? null,
        });
        toast({ title: "Başarılı", description: "Personel güncellendi" });

        try {
          const syncResult = await syncToDevices({ employeeId: editingId });
          reportSyncResult(syncResult.synced, syncResult.failed, syncResult.errors);
        } catch (error: unknown) {
          notify.error("Personel kaydedildi; cihaz senkronizasyonu tamamlanamadı", error);
        }

        onSave({ _id: editingId, ...formData });
        onClose();
      } else {
        // Create
        const newId = await createEmployee({
          projectId: formData.projectId,
          ...sharedPayload,
        });
        toast({ title: "Başarılı", description: "Personel eklendi" });

        try {
          const emailResult = await sendSetupEmail({
            employeeId: newId,
            email: sharedPayload.email,
            firstName: sharedPayload.firstName,
            lastName: sharedPayload.lastName,
            projectId: formData.projectId,
          });
          if (!emailResult.success) throw new Error("Kurulum e-postası gönderilemedi");
          toast({ title: "Kurulum E-postası", description: "Personele kurulum bağlantısı gönderildi" });
        } catch {
          toast({
            title: "Uyarı",
            description: "Personel eklendi ancak kurulum e-postası gönderilemedi",
            variant: "destructive",
          });
        }

        try {
          const syncResult = await syncToDevices({ employeeId: newId });
          reportSyncResult(syncResult.synced, syncResult.failed, syncResult.errors);
        } catch (error: unknown) {
          notify.error("Personel kaydedildi; cihaz senkronizasyonu tamamlanamadı", error);
        }

        onSave({ _id: newId, ...formData });
        onClose();
      }
  }, { error: "Personel kaydedilemedi" });

  return { isLoading, handleSubmit };
};
