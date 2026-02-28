import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "@/hooks/use-toast";
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
  shift_id: string | null;
  shift: string | null;
  photo_url: string | null;
  notes: string;
  is_active: boolean;
  projectId?: Id<"projects">;
}

interface EmployeeInput {
  _id?: Id<"employees">;
  firstName?: string;
  lastName?: string;
}

export const useEmployeeFormSubmit = (
  employee: EmployeeInput | null | undefined,
  onClose: () => void,
  onSave: (employee: unknown) => void
) => {
  const [isLoading, setIsLoading] = useState(false);

  const createEmployee = useMutation(api.employees.create);
  const updateEmployee = useMutation(api.employees.update);
  const checkDuplicate = useMutation(api.employees.update);
  const sendSetupEmail = useAction(api.actions.sendEmail.sendEmployeeSetupEmail);
  const syncToDevices = useAction(api.actions.hikvisionSync.syncEmployeeToDevices);

  const handleSubmit = async (formData: EmployeeFormData) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (!formData.first_name?.trim()) {
        toast({ title: "Hata", description: "Ad alanı zorunludur", variant: "destructive" });
        return;
      }
      if (!formData.last_name?.trim()) {
        toast({ title: "Hata", description: "Soyad alanı zorunludur", variant: "destructive" });
        return;
      }
      if (!formData.email?.trim()) {
        toast({ title: "Hata", description: "E-posta alanı zorunludur", variant: "destructive" });
        return;
      }
      if (!formData.tc_no?.trim() || formData.tc_no.length !== 11) {
        toast({ title: "Hata", description: "TC Kimlik No 11 haneli olmalıdır", variant: "destructive" });
        return;
      }
      if (!formData.card_number?.trim()) {
        toast({ title: "Hata", description: "Kart numarası zorunludur", variant: "destructive" });
        return;
      }

      if (employee?._id) {
        // Update
        await updateEmployee({
          employeeId: employee._id,
          firstName: formData.first_name.trim(),
          lastName: formData.last_name.trim(),
          email: formData.email.trim().toLowerCase(),
          tcNo: formData.tc_no.trim(),
          cardNumber: formData.card_number.trim(),
          companyId: (formData.company_id ?? undefined) as Id<"companies"> | undefined,
          departmentId: (formData.department_id ?? undefined) as Id<"departments"> | undefined,
          positionId: (formData.position_id ?? undefined) as Id<"positions"> | undefined,
          accessRuleId: (formData.access_rule_id ?? undefined) as Id<"accessRules"> | undefined,
          shiftId: (formData.shift_id ?? undefined) as Id<"shifts"> | undefined,
          shift: formData.shift ?? undefined,
          photoUrl: formData.photo_url ?? undefined,
          notes: formData.notes?.trim() ?? undefined,
          isActive: formData.is_active ?? true,
        });
        toast({ title: "Başarılı", description: "Çalışan bilgileri güncellendi" });

        // Hikvision cihazlarına senkronize et
        try {
          const syncResult = await syncToDevices({ employeeId: employee._id });
          if (syncResult.synced > 0) {
            toast({ title: "Cihaz Senkronizasyonu", description: `${syncResult.synced} cihaza senkronize edildi` });
          }
          if (syncResult.failed > 0) {
            toast({ title: "Senkronizasyon Uyarısı", description: `${syncResult.failed} cihaza gönderilemedi`, variant: "destructive" });
          }
        } catch {
          // Sync hatası çalışan kaydını engellemez
        }

        onSave({ _id: employee._id, ...formData });
        onClose();
      } else {
        // Create
        const newId = await createEmployee({
          firstName: formData.first_name.trim(),
          lastName: formData.last_name.trim(),
          email: formData.email.trim().toLowerCase(),
          tcNo: formData.tc_no.trim(),
          cardNumber: formData.card_number.trim(),
          projectId: formData.projectId,
          companyId: (formData.company_id ?? undefined) as Id<"companies"> | undefined,
          departmentId: (formData.department_id ?? undefined) as Id<"departments"> | undefined,
          positionId: (formData.position_id ?? undefined) as Id<"positions"> | undefined,
          accessRuleId: (formData.access_rule_id ?? undefined) as Id<"accessRules"> | undefined,
          shiftId: (formData.shift_id ?? undefined) as Id<"shifts"> | undefined,
          shift: formData.shift ?? undefined,
          photoUrl: formData.photo_url ?? undefined,
          notes: formData.notes?.trim() ?? undefined,
          isActive: formData.is_active ?? true,
        });

        // Setup email gönder
        try {
          await sendSetupEmail({
            employeeId: newId,
            email: formData.email.trim().toLowerCase(),
            firstName: formData.first_name.trim(),
            lastName: formData.last_name.trim(),
            projectId: formData.projectId,
          });
          toast({ title: "Başarılı", description: "Personel eklendi ve kurulum e-postası gönderildi" });
        } catch {
          toast({
            title: "Uyarı",
            description: "Personel eklendi ancak kurulum e-postası gönderilemedi",
            variant: "destructive",
          });
        }

        // Hikvision cihazlarına senkronize et
        try {
          const syncResult = await syncToDevices({ employeeId: newId });
          if (syncResult.synced > 0) {
            toast({ title: "Cihaz Senkronizasyonu", description: `${syncResult.synced} cihaza senkronize edildi` });
          }
          if (syncResult.failed > 0) {
            toast({ title: "Senkronizasyon Uyarısı", description: `${syncResult.failed} cihaza gönderilemedi`, variant: "destructive" });
          }
        } catch {
          // Sync hatası çalışan kaydını engellemez
        }

        onSave({ _id: newId, ...formData });
        onClose();
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        title: "Hata",
        description: err?.message ?? "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, handleSubmit };
};
