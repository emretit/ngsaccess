import { makeFunctionReference } from "convex/server";
import type { VisitorHostOption } from "../../../../convex/visitorHosts";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { VisitorDetail } from "@/types/visitor";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { Id } from "../../../../convex/_generated/dataModel";
import { isoToLocalInput, defaultExpiryLocalInput } from "../visitorTime";
import { isVisitorCardPlaceholder } from "../lib/preRegistration";

// Typed reference keeps this isolated module usable before deployment codegen.
// TODO(ziy-R3): codegen sonrası api.visitorHosts.search
const hostSearchQuery = makeFunctionReference<"query", { projectId: Id<"projects">; search: string }, VisitorHostOption[]>("visitorHosts:search");

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
  kvkkDocumentVersion?: string;
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
  const [hostSearch, setHostSearch] = useState("");
  const [debouncedHostSearch, setDebouncedHostSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedHostSearch(hostSearch), 200);
    return () => clearTimeout(timer);
  }, [hostSearch]);
  const employeesData = useQuery(
    hostSearchQuery,
    !loading && formData.projectId ? { projectId: formData.projectId, search: debouncedHostSearch } : "skip",
  );

  const optionsLoading = presetRulesData === undefined;
  const hostsLoading = employeesData === undefined || hostSearch !== debouncedHostSearch;

  const presetRules = (presetRulesData ?? [])
    .filter((r) => r.isActive || r._id === visitor?.presetRuleId)
    .map((r) => ({ id: r._id, name: !r.isActive ? `${r.name} (Pasif)` : r.hasDoors ? r.name : `${r.name} (Kapı yok)`, disabled: !r.isActive || !r.hasDoors }));
  if (visitor?.presetRuleId && !presetRules.some(rule => rule.id === visitor.presetRuleId)) {
    presetRules.push({ id: visitor.presetRuleId, name: visitor.presetRuleName ?? "Kayıtlı erişim bölgesi", disabled: true });
  }
  const hostEmployees = (employeesData ?? []).map((e) => ({
    id: e._id,
    name: `${e.firstName} ${e.lastName}${e.isActive ? "" : " (Pasif)"}`,
  }));

  if (visitor?.hostEmployeeId && visitor.hostName && !hostEmployees.some(host => host.id === visitor.hostEmployeeId)) {
    hostEmployees.push({ id: visitor.hostEmployeeId, name: visitor.hostName });
  }

  useEffect(() => {
    if (visitor) {
      const initial: VisitorFormData = {
        firstName: visitor.firstName || "",
        lastName: visitor.lastName || "",
        visitorPhone: visitor.visitorPhone || "",
        visitorCompany: visitor.visitorCompany || "",
        visitPurpose: visitor.visitPurpose || "",
        hostEmployeeId: visitor.hostEmployeeId ?? null,
        // Maskeli, iade ve ön kayıt değerleri gerçek kart yerine kaydedilmez.
        cardNumber: visitor.sensitiveMasked || isVisitorCardPlaceholder(visitor.cardNumber) ? "" : visitor.cardNumber || "",
        presetRuleId: visitor.presetRuleId ?? null,
        accessExpiresAt: visitor.visitEnd
          ? isoToLocalInput(visitor.visitEnd)
          : "",
        isActive: visitor.isActive ?? true,
        notes: visitor.notes || "",
        kvkkConsent: visitor.hasKvkkConsent ?? false,
        kvkkDocumentVersion: visitor.kvkkConsent?.version ?? undefined,
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

  return { formData, setFormData, presetRules, hostEmployees, hostSearch, setHostSearch, hostsLoading, optionsLoading, isDirty: JSON.stringify(formData) !== JSON.stringify(initialData) };
};
