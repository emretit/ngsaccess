import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "@/hooks/use-toast";
import { Id } from "../../../../convex/_generated/dataModel";
import { Employee } from "@/types/employee";
import { EmployeeFormData } from "./useEmployeeFormData";

export type { EmployeeFormData };

const errorMessage = (err: unknown, fallback = "Bir hata oluştu"): string =>
  err instanceof Error ? err.message : typeof err === "string" ? err : fallback;

const reportSyncResult = (synced: number, failed: number) => {
  if (synced > 0) {
    toast({
      title: "Cihaz Senkronizasyonu",
      description: `${synced} cihaza senkronize edildi`,
    });
  }
  if (failed > 0) {
    toast({
      title: "Senkronizasyon Uyarısı",
      description: `${failed} cihaza gönderilemedi`,
      variant: "destructive",
    });
  }
};

export const useEmployeeFormSubmit = (
  employee: Pick<Employee, "_id"> | null | undefined,
  onClose: () => void,
  onSave: (payload?: unknown) => void
) => {
  const [isLoading, setIsLoading] = useState(false);

  const createEmployee = useMutation(api.employees.create);
  const updateEmployee = useMutation(api.employees.update);
  const sendSetupEmail = useAction(api.actions.sendEmail.sendEmployeeSetupEmail);
  const syncToDevices = useAction(api.actions.hikvisionSync.syncEmployeeToDevices);

  // Form gönderildiği anda employee._id'yi snapshot al — sheet kapanırken
  // parent state temizlenirse closure'daki employee null olabilir.
  const editingId = employee?._id;

  const handleSubmit = async (formData: EmployeeFormData) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (!formData.firstName?.trim()) {
        toast({ title: "Hata", description: "Ad alanı zorunludur", variant: "destructive" });
        return;
      }
      if (!formData.lastName?.trim()) {
        toast({ title: "Hata", description: "Soyad alanı zorunludur", variant: "destructive" });
        return;
      }
      if (!formData.email?.trim()) {
        toast({ title: "Hata", description: "E-posta alanı zorunludur", variant: "destructive" });
        return;
      }
      if (!formData.tcNo?.trim() || formData.tcNo.length !== 11) {
        toast({ title: "Hata", description: "TC Kimlik No 11 haneli olmalıdır", variant: "destructive" });
        return;
      }
      if (!formData.cardNumber?.trim()) {
        toast({ title: "Hata", description: "Kart numarası zorunludur", variant: "destructive" });
        return;
      }

      const sharedPayload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        tcNo: formData.tcNo.trim(),
        cardNumber: formData.cardNumber.trim(),
        companyId: (formData.companyId ?? undefined) as Id<"companies"> | undefined,
        departmentId: (formData.departmentId ?? undefined) as Id<"departments"> | undefined,
        positionId: (formData.positionId ?? undefined) as Id<"positions"> | undefined,
        accessRuleId: (formData.accessRuleId ?? undefined) as Id<"accessRules"> | undefined,
        shiftId: (formData.shiftId ?? undefined) as Id<"shifts"> | undefined,
        shift: formData.shift ?? undefined,
        photoUrl: formData.photoUrl ?? undefined,
        notes: formData.notes?.trim() ?? undefined,
        isActive: formData.isActive ?? true,
      };

      if (editingId) {
        // Update
        await updateEmployee({
          employeeId: editingId,
          projectId: formData.projectId,
          ...sharedPayload,
        });
        toast({ title: "Başarılı", description: "Personel güncellendi" });

        try {
          const syncResult = await syncToDevices({ employeeId: editingId });
          reportSyncResult(syncResult.synced, syncResult.failed);
        } catch {
          // Sync hatası kaydı engellemez
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
          await sendSetupEmail({
            employeeId: newId,
            email: sharedPayload.email,
            firstName: sharedPayload.firstName,
            lastName: sharedPayload.lastName,
            projectId: formData.projectId,
          });
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
          reportSyncResult(syncResult.synced, syncResult.failed);
        } catch {
          // Sync hatası kaydı engellemez
        }

        onSave({ _id: newId, ...formData });
        onClose();
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, handleSubmit };
};
