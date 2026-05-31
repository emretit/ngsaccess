import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Visitor } from "@/types/visitor";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useProjectAccess } from "@/hooks/useProjectAccess";
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
  accessExpiresAt: string; // datetime-local (tarayıcı yerel saati)
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

export const useVisitorFormData = (visitor?: Visitor | null) => {
  const { projectId: defaultProjectId } = useActiveProject();
  const { projectIds, isSuperAdmin, loading } = useProjectAccess();

  const [formData, setFormData] = useState<VisitorFormData>(() => emptyForm(defaultProjectId));

  const presetRulesData = useQuery(api.visitors.presetRules, {});
  const employeesData = useQuery(
    api.employees.list,
    !loading ? { projectIds, isSuperAdmin } : "skip",
  );

  const optionsLoading = presetRulesData === undefined || employeesData === undefined;

  const presetRules = (presetRulesData ?? [])
    .filter((r) => r.isActive)
    .map((r) => ({ id: r._id, name: r.name }));
  const hostEmployees = (employeesData ?? []).map((e) => ({
    id: e._id,
    name: `${e.firstName} ${e.lastName}`,
  }));

  useEffect(() => {
    if (visitor) {
      setFormData({
        firstName: visitor.firstName || "",
        lastName: visitor.lastName || "",
        visitorPhone: visitor.visitorPhone || "",
        visitorCompany: visitor.visitorCompany || "",
        visitPurpose: visitor.visitPurpose || "",
        hostEmployeeId: visitor.hostEmployeeId ?? null,
        cardNumber: visitor.cardNumber || "",
        presetRuleId: visitor.accessRuleId ?? null,
        accessExpiresAt: visitor.accessExpiresAt
          ? isoToLocalInput(visitor.accessExpiresAt)
          : defaultExpiryLocalInput(),
        isActive: visitor.isActive ?? true,
        notes: visitor.notes || "",
        kvkkConsent: visitor.hasKvkkConsent ?? false,
        projectId: visitor.projectId ?? defaultProjectId,
      });
    } else {
      setFormData(emptyForm(defaultProjectId));
    }
    // Form sadece düzenlenen ziyaretçi (_id) değiştiğinde reset edilir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitor?._id, defaultProjectId]);

  return { formData, setFormData, presetRules, hostEmployees, optionsLoading };
};
