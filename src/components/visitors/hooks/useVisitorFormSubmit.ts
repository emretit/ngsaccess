import { useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { VisitorPassSecret } from "../VisitorPassCard";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { VisitorDetail } from "@/types/visitor";
import type { VisitorFormData } from "./useVisitorFormData";
import { visitorFormPayload } from "../lib/formPayload";

export const useVisitorFormSubmit = (visitor: VisitorDetail | null | undefined, onSave: (payload?: unknown) => void) => {
  const [issued, setIssued] = useState<{ visitorId: Id<"employees">; secret: VisitorPassSecret } | null>(null);
  const [savedId, setSavedId] = useState<Id<"employees"> | null>(null);
  const issue = useMutation(api.visitorPasses.issue);
  const createVisitor = useMutation(api.visitors.create);
  const updateVisitor = useMutation(api.visitors.update);
  const action = useAsyncAction(async (formData: VisitorFormData) => {
    const payload = visitorFormPayload(formData, visitor);
    const id = savedId ?? (payload.kind === "update" ? await updateVisitor(payload.args) : await createVisitor(payload.args));
    if (payload.kind === "create" && formData.credential === "pass") {
      setSavedId(id);
      const secret = await issue({ visitorId: id, ...(formData.maxUses?.trim() ? { maxUses: Number(formData.maxUses) } : {}) });
      setIssued({ visitorId: id, secret });
      return;
    }
    notify.success("Ziyaretçi kaydedildi", "Cihaz işlemleri arka planda yürütülüyor; sonuçları senkronizasyon şeridinden izleyin.");
    onSave({ _id: id });
  }, { error: "Ziyaretçi kaydedilemedi" });
  return { isLoading: action.pending, handleSubmit: action.run, issued, savedId };
};
