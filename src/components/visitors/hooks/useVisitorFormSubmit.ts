import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "@/hooks/use-toast";
import { Visitor } from "@/types/visitor";
import { VisitorFormData } from "./useVisitorFormData";
import { visitorFormSchema } from "./useVisitorFormSchema";
import { localInputToIso } from "../visitorTime";
import type { Id } from "../../../../convex/_generated/dataModel";

export type { VisitorFormData };

const errorMessage = (err: unknown, fallback = "Bir hata oluştu"): string =>
  err instanceof Error ? err.message : typeof err === "string" ? err : fallback;

const reportSyncResult = (synced: number, failed: number, errors: string[] = []) => {
  if (synced > 0) {
    toast({
      variant: "success",
      title: "Cihaz Senkronizasyonu",
      description: `${synced} cihaza senkronize edildi`,
    });
  }
  if (failed > 0) {
    const detail =
      errors.length > 0
        ? errors.slice(0, 3).join(" • ") + (errors.length > 3 ? ` (+${errors.length - 3})` : "")
        : `${failed} cihaza gönderilemedi`;
    toast({ title: `${failed} cihaza gönderilemedi`, description: detail, variant: "destructive" });
  }
};

export const useVisitorFormSubmit = (
  visitor: Pick<Visitor, "_id"> | null | undefined,
  onClose: () => void,
  onSave: (payload?: unknown) => void,
) => {
  const [isLoading, setIsLoading] = useState(false);

  const createVisitor = useMutation(api.visitors.create);
  const updateVisitor = useMutation(api.visitors.update);
  const syncToDevices = useAction(api.actions.hikvisionSync.syncEmployeeToDevices);

  const editingId = visitor?._id;

  const handleSubmit = async (formData: VisitorFormData) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const parsed = visitorFormSchema.safeParse({
        firstName: formData.firstName,
        lastName: formData.lastName,
        cardNumber: formData.cardNumber,
        presetRuleId: formData.presetRuleId ?? "",
        accessExpiresAt: formData.accessExpiresAt,
      });
      if (!parsed.success) {
        toast({
          title: "Hata",
          description: parsed.error.issues[0]?.message ?? "Form bilgileri geçersiz",
          variant: "destructive",
        });
        return;
      }

      const shared = {
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
        cardNumber: parsed.data.cardNumber.trim(),
        accessExpiresAt: localInputToIso(parsed.data.accessExpiresAt),
        visitorPhone: formData.visitorPhone.trim() || undefined,
        visitorCompany: formData.visitorCompany.trim() || undefined,
        visitPurpose: formData.visitPurpose.trim() || undefined,
        hostEmployeeId: formData.hostEmployeeId ?? undefined,
        isActive: formData.isActive,
        notes: formData.notes.trim() || undefined,
        kvkkConsent: formData.kvkkConsent,
      };

      if (editingId) {
        await updateVisitor({ visitorId: editingId, ...shared });
        toast({ title: "Başarılı", description: "Ziyaretçi güncellendi" });
        try {
          const r = await syncToDevices({ employeeId: editingId });
          reportSyncResult(r.synced, r.failed, r.errors);
        } catch {
          /* sync hatası kaydı engellemez */
        }
        onSave({ _id: editingId });
        onClose();
      } else {
        const newId = await createVisitor({
          projectId: formData.projectId,
          presetRuleId: parsed.data.presetRuleId as Id<"accessRules">,
          ...shared,
        });
        toast({ title: "Başarılı", description: "Ziyaretçi eklendi" });
        try {
          const r = await syncToDevices({ employeeId: newId });
          reportSyncResult(r.synced, r.failed, r.errors);
        } catch {
          /* sync hatası kaydı engellemez */
        }
        onSave({ _id: newId });
        onClose();
      }
    } catch (error) {
      toast({ title: "Hata", description: errorMessage(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, handleSubmit };
};
