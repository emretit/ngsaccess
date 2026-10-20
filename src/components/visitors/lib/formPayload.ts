import type { FunctionArgs } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import type { VisitorDetail } from "@/types/visitor";
import type { VisitorFormData } from "../hooks/useVisitorFormData";
import { visitorFormSchema } from "../hooks/useVisitorFormSchema";
import { isoToLocalInput, localInputToIso } from "../visitorTime";
import type { Id } from "../../../../convex/_generated/dataModel";
import { canAssignVisitorPreset } from "./preRegistration";

type FormPayload = { kind: "create"; args: FunctionArgs<typeof api.visitors.create> } | { kind: "update"; args: FunctionArgs<typeof api.visitors.update> };
export function visitorFormPayload(formData: VisitorFormData, visitor?: VisitorDetail | null): FormPayload {
  const originalExpiry = visitor ? isoToLocalInput(visitor.visitEnd ?? "") : undefined;
  const isPreRegistration = canAssignVisitorPreset(visitor);
  const parsed = visitorFormSchema.parse({ ...formData, isEditing: !!visitor, isPreRegistration, originalExpiry, wasActive: visitor?.isActive });
  const shared = { firstName: parsed.firstName, lastName: parsed.lastName, isActive: formData.isActive, kvkkConsent: formData.kvkkConsent, kvkkDocumentVersion: formData.kvkkDocumentVersion };
  if (visitor) {
    return { kind: "update", args: {
      visitorId: visitor._id, projectId: formData.projectId, ...shared,
      ...(isPreRegistration && formData.presetRuleId ? { presetRuleId: formData.presetRuleId } : {}),
      ...(parsed.accessExpiresAt !== originalExpiry ? { accessExpiresAt: localInputToIso(parsed.accessExpiresAt) } : {}),
      cardNumber: parsed.cardNumber || undefined,
      visitorPhone: formData.visitorPhone.trim() || null,
      visitorCompany: formData.visitorCompany.trim() || null,
      visitPurpose: formData.visitPurpose.trim() || null,
      hostEmployeeId: formData.hostEmployeeId, notes: formData.notes.trim() || null,
    } };
  }
  return { kind: "create", args: {
    ...shared, projectId: formData.projectId, accessExpiresAt: localInputToIso(parsed.accessExpiresAt),
    presetRuleId: parsed.presetRuleId as Id<"accessRules">, cardNumber: parsed.cardNumber,
    visitorPhone: formData.visitorPhone.trim() || undefined,
    visitorCompany: formData.visitorCompany.trim() || undefined,
    visitPurpose: formData.visitPurpose.trim() || undefined,
    hostEmployeeId: formData.hostEmployeeId ?? undefined, notes: formData.notes.trim() || undefined,
  } };
}
