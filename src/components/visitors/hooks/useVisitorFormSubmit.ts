import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { VisitorDetail } from "@/types/visitor";
import type { VisitorFormData } from "./useVisitorFormData";
import { visitorFormPayload } from "../lib/formPayload";

export const useVisitorFormSubmit = (visitor: VisitorDetail | null | undefined, onSave: (payload?: unknown) => void) => {
  const createVisitor = useMutation(api.visitors.create);
  const updateVisitor = useMutation(api.visitors.update);
  const action = useAsyncAction(async (formData: VisitorFormData) => {
    const payload = visitorFormPayload(formData, visitor);
    const id = payload.kind === "update" ? await updateVisitor(payload.args) : await createVisitor(payload.args);
    notify.success("Ziyaretçi kaydedildi", "Cihaz işlemleri arka planda yürütülüyor; sonuçları senkronizasyon şeridinden izleyin.");
    onSave({ _id: id });
  }, { error: "Ziyaretçi kaydedilemedi" });
  return { isLoading: action.pending, handleSubmit: action.run };
};
