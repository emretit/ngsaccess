import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { VisitorDetail } from "@/types/visitor";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { Id } from "../../../../convex/_generated/dataModel";
import { isoToLocalInput, defaultExpiryLocalInput } from "../visitorTime";
import { isVisitorCardPlaceholder } from "../lib/preRegistration";

export interface VisitorFormData {
  firstName: string;
  lastName: string;
  visitorPhone: string;
  visitorCompany: string;
  visitPurpose: string;
  hostEmployeeId: Id<"employees"> | null;
  cardNumber: string;
  credential?: "card" | "pass";
  maxUses?: string;
  email?: string;
  // ZoneDeviceTree seçimi; sunucu kapı setine göre ziyaretçi kuralını bulur ya da oluşturur.
  selected_doors: string[];
  selected_devices: string[];
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
  credential: "card",
  maxUses: "",
  email: "",
  selected_doors: [],
  selected_devices: [],
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

  const [hostSearch, setHostSearch] = useState("");
  const [debouncedHostSearch, setDebouncedHostSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedHostSearch(hostSearch), 200);
    return () => clearTimeout(timer);
  }, [hostSearch]);
  const employeesData = useQuery(
    api.visitorHosts.search,
    !loading && formData.projectId ? { projectId: formData.projectId, search: debouncedHostSearch } : "skip",
  );

  const hostsLoading = employeesData === undefined || hostSearch !== debouncedHostSearch;

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
        credential: visitor.visitorCredential ?? "card",
        email: visitor.email ?? "",
        maxUses: "",
        selected_doors: [],
        selected_devices: [],
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

  return { formData, setFormData, hostEmployees, hostSearch, setHostSearch, hostsLoading, isDirty: JSON.stringify(formData) !== JSON.stringify(initialData) };
};
