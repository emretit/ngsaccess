import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import type { Employee } from "@/types/employee";
import type { Doc } from "../../../../convex/_generated/dataModel";

// Ortak Employee sözleşmesini değiştirmeden schema alanlarını koru.
export type EmploymentEmployee = Employee & Pick<Doc<"employees">,
  "employmentEndDate" | "terminationType" | "terminationReason" | "sgkExitCode" | "isVisitor">;

export const terminationLabels = {
  resignation: "İstifa", employerTermination: "İşveren feshi", retirement: "Emeklilik",
  contractEnd: "Sözleşme sonu", other: "Diğer",
} as const;
export const transferLabel = "Başka projeye taşındı";

export type EmployeeTransfer = NonNullable<FunctionReturnType<typeof api.employeeTermination.getEmployeeTransfer>>;

export function isTransferActive(transfer: EmployeeTransfer | null | undefined): boolean {
  return transfer?.status === "requested" || transfer?.status === "revoking" || transfer?.status === "stuck" ||
    transfer?.status === "revoked" || transfer?.status === "provisioning";
}
