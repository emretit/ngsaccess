import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "@/hooks/use-toast";
import { Id } from "../../../../convex/_generated/dataModel";

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

      if (employee?._id) {
        // Update
        await updateEmployee({
          employeeId: employee._id,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim().toLowerCase(),
          tcNo: formData.tcNo.trim(),
          cardNumber: formData.cardNumber.trim(),
          companyId: formData.companyId ?? undefined,
          departmentId: formData.departmentId ?? undefined,
          positionId: formData.positionId ?? undefined,
          accessRuleId: formData.accessRuleId ?? undefined,
          shiftId: formData.shiftId ?? undefined,
          shift: formData.shift ?? undefined,
          photoUrl: formData.photoUrl ?? undefined,
          notes: formData.notes?.trim() ?? undefined,
          isActive: formData.isActive ?? true,
        });
        toast({ title: "Başarılı", description: "Çalışan bilgileri güncellendi" });
        onSave({ _id: employee._id, ...formData });
        onClose();
      } else {
        // Create
        const newId = await createEmployee({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim().toLowerCase(),
          tcNo: formData.tcNo.trim(),
          cardNumber: formData.cardNumber.trim(),
          projectId: formData.projectId,
          companyId: formData.companyId ?? undefined,
          departmentId: formData.departmentId ?? undefined,
          positionId: formData.positionId ?? undefined,
          accessRuleId: formData.accessRuleId ?? undefined,
          shiftId: formData.shiftId ?? undefined,
          shift: formData.shift ?? undefined,
          photoUrl: formData.photoUrl ?? undefined,
          notes: formData.notes?.trim() ?? undefined,
          isActive: formData.isActive ?? true,
        });

        // Setup email gönder
        try {
          await sendSetupEmail({
            employeeId: newId,
            email: formData.email.trim().toLowerCase(),
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
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
