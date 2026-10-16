import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Visitor } from "@/types/visitor";
import { VisitorFormData } from "./useVisitorFormData";
import { visitorFormSchema } from "./useVisitorFormSchema";
import { localInputToIso } from "../visitorTime";
import type { Id } from "../../../../convex/_generated/dataModel";

export type { VisitorFormData };

export const useVisitorFormSubmit = (
  visitor: Pick<Visitor, "_id"> | null | undefined,
  onClose: () => void,
  onSave: (payload?: unknown) => void,
) => {
  const createVisitor = useMutation(api.visitors.create);
  const updateVisitor = useMutation(api.visitors.update);
  const action = useAsyncAction(async (formData: VisitorFormData) => {
    const parsed = visitorFormSchema.parse({ ...formData, isEditing: !!visitor });
    const shared = {
      firstName: parsed.firstName, lastName: parsed.lastName,
      accessExpiresAt: localInputToIso(parsed.accessExpiresAt),
      isActive: formData.isActive, kvkkConsent: formData.kvkkConsent,
    };
    let id: Id<"employees">;
    if (visitor) {
      id = await updateVisitor({
        visitorId: visitor._id, ...shared,
        cardNumber: parsed.cardNumber || undefined,
        visitorPhone: formData.visitorPhone.trim() || null,
        visitorCompany: formData.visitorCompany.trim() || null,
        visitPurpose: formData.visitPurpose.trim() || null,
        hostEmployeeId: formData.hostEmployeeId,
        notes: formData.notes.trim() || null,
      });
    } else {
      id = await createVisitor({
        ...shared, projectId: formData.projectId,
        presetRuleId: parsed.presetRuleId as Id<"accessRules">,
        cardNumber: parsed.cardNumber,
        visitorPhone: formData.visitorPhone.trim() || undefined,
        visitorCompany: formData.visitorCompany.trim() || undefined,
        visitPurpose: formData.visitPurpose.trim() || undefined,
        hostEmployeeId: formData.hostEmployeeId ?? undefined,
        notes: formData.notes.trim() || undefined,
      });
    }
    // Sync'i backend başlatır; ikinci bir action çağrısı kayıt başarısını gölgelememeli.
    notify.success("Ziyaretçi kaydedildi", "Cihaz işlemleri arka planda yürütülür; sonuçları senkronizasyon şeridinden izleyin.");
    onSave({ _id: id });
    onClose();
  }, { error: "Ziyaretçi kaydedilemedi" });
  return { isLoading: action.pending, handleSubmit: action.run };
};
