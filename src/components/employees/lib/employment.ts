import type { Employee } from "@/types/employee";
import type { Doc } from "../../../../convex/_generated/dataModel";

// Ortak Employee sözleşmesini değiştirmeden schema alanlarını koru.
export type EmploymentEmployee = Employee & Pick<Doc<"employees">,
  "employmentEndDate" | "terminationType" | "terminationReason" | "sgkExitCode" | "isVisitor">;

export const terminationLabels = {
  resignation: "İstifa", employerTermination: "İşveren feshi", retirement: "Emeklilik",
  contractEnd: "Sözleşme sonu", other: "Diğer",
} as const;
