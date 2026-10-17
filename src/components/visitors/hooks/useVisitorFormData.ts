import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { VisitorDetail } from "@/types/visitor";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { Id } from "../../../../convex/_generated/dataModel";
import { isoToLocalInput, defaultExpiryLocalInput } from "../visitorTime";

export interface VisitorFormData {
  firstName: string;
  lastName: string;
  visitorPhone: string;
  visitorCompany: string;
  visitPurpose: string;
  hostEmployeeId: Id<"employees"> | null;
  cardNumber: string;
  presetRuleId: Id<"accessRules"> | null;
  accessExpiresAt: string; // datetime-local (TR saati)
  isActive: boolean;
  notes: string;
  kvkkConsent: boolean;
  projectId?: Id<"projects">;
}

const emptyForm = (projectId?: Id<"projects">): VisitorFormData => ({
  firstName: "",
  lastName: "",
  visitorPhone: "",
  visitorCompany: "",
  visitPurpose: "",
  hostEmployeeId: null,
  cardNumber: "",
  presetRuleId: null,
  accessExpiresAt: defaultExpiryLocalInput(),
  isActive: true,
  notes: "",
  kvkkConsent: false,
  projectId,
});

export const useVisitorFormData = (visitor?: VisitorDetail | null) => {
  const { projectId: defaultProjectId, loading } = useActiveProjectScope();

  const [formData, setFormData] = useState<VisitorFormData>(() => emptyForm(defaultProjectId));

  const [initialData, setInitialData] = useState<VisitorFormData>(() => emptyForm(defaultProjectId));

  const presetRulesData = useQuery(api.visitors.presetRules, !loading && defaultProjectId ? { projectId: defaultProjectId } : "skip");
  const employeesData = useQuery(
    api.employees.list,
    !loading && defaultProjectId ? { projectId: defaultProjectId } : "skip",
  );

  const optionsLoading = presetRulesData === undefined || employeesData === undefined;

  const presetRules = (presetRulesData ?? [])
    .filter((r) => r.isActive || r._id === visitor?.presetRuleId)
    .map((r) => ({ id: r._id, name: r.name }));
  if (visitor?.presetRuleId && !presetRules.some(rule => rule.id === visitor.presetRuleId)) {
    presetRules.push({ id: visitor.presetRuleId, name: visitor.presetRuleName ?? "Kayıtlı erişim bölgesi" });
  }
  const hostEmployees = (employeesData ?? []).filter(e => !e.isVisitor).map((e) => ({
    id: e._id,
    name: `${e.firstName} ${e.lastName}${e.isActive ? "" : " (Pasif)"}`,
  }));

  useEffect(() => {
    if (visitor) {
      const initial: VisitorFormData = {
        firstName: visitor.firstName || "",
        lastName: visitor.lastName || "",
        visitorPhone: visitor.visitorPhone || "",
        visitorCompany: visitor.visitorCompany || "",
        visitPurpose: visitor.visitPurpose || "",
        hostEmployeeId: visitor.hostEmployeeId ?? null,
        // Maskeli değer forma girmez; aksi halde kayıtta kart "•••• 1234" ile ezilir.
        cardNumber: visitor.sensitiveMasked || visitor.cardNumber?.startsWith("IADE:") ? "" : visitor.cardNumber || "",
        presetRuleId: visitor.presetRuleId ?? null,
        accessExpiresAt: visitor.visitEnd
          ? isoToLocalInput(visitor.visitEnd)
          : "",
        isActive: visitor.isActive ?? true,
        notes: visitor.notes || "",
        kvkkConsent: visitor.hasKvkkConsent ?? false,
        projectId: visitor.projectId ?? defaultProjectId,
      };
      setFormData(initial);
      setInitialData(initial);
    } else {
      const initial = emptyForm(defaultProjectId);
      setFormData(initial);
      setInitialData(initial);
    }
    // Form sadece düzenlenen ziyaretçi (_id) değiştiğinde reset edilir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitor?._id, defaultProjectId]);

  return { formData, setFormData, presetRules, hostEmployees, optionsLoading, isDirty: JSON.stringify(formData) !== JSON.stringify(initialData) };
};
