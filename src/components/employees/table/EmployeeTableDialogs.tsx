import {
  selectedEmployeeNames,
  employeeSelectionName,
} from "./employeeTableModel";
import { EmployeeSyncConfirmDialog } from "../EmployeeSyncConfirmDialog";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { EmploymentEmployee as Employee } from "../lib/employment";
import { BatchCardAssignDialog } from "../import/BatchCardAssignDialog";
import { EmployeeDeleteDialog } from "../EmployeeDeleteDialog";
import { EmployeePasswordResetDialog } from "../EmployeePasswordResetDialog";
type Props = {
  showDeleteDialog: boolean;
  setShowDeleteDialog: (open: boolean) => void;
  selectedEmployees: Id<"employees">[];
  employees: Employee[];
  handleBulkDelete: () => Promise<void>;
  showIndividualDeleteDialog: boolean;
  setShowIndividualDeleteDialog: (open: boolean) => void;
  selectedEmployeeForDelete: Employee | null;
  handleIndividualDeleteConfirm: () => Promise<void>;
  syncRequest: { employees: Employee[]; retry?: boolean } | null;
  setSyncRequest: (
    request: { employees: Employee[]; retry?: boolean } | null,
  ) => void;
  handleSyncToDevice: (employee: Employee) => unknown;
  handleBulkSyncToDevices: (retry: boolean) => unknown;
  cardAssignEmployees: Employee[] | null;
  isAdmin: boolean;
  projectId: Id<"projects"> | null | undefined;
  setCardAssignEmployees: (employees: Employee[] | null) => void;
  showPasswordResetDialog: boolean;
  setShowPasswordResetDialog: (open: boolean) => void;
  selectedEmployeeForReset: Employee | null;
};
export function EmployeeTableDialogs({
  showDeleteDialog,
  setShowDeleteDialog,
  selectedEmployees,
  employees,
  handleBulkDelete,
  showIndividualDeleteDialog,
  setShowIndividualDeleteDialog,
  selectedEmployeeForDelete,
  handleIndividualDeleteConfirm,
  syncRequest,
  setSyncRequest,
  handleSyncToDevice,
  handleBulkSyncToDevices,
  cardAssignEmployees,
  isAdmin,
  projectId,
  setCardAssignEmployees,
  showPasswordResetDialog,
  setShowPasswordResetDialog,
  selectedEmployeeForReset,
}: Props) {
  return (
    <>
      <EmployeeDeleteDialog
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedCount={selectedEmployees.length}
        names={selectedEmployeeNames(employees, selectedEmployees)}
        onConfirm={handleBulkDelete}
      />

      <EmployeeDeleteDialog
        isOpen={showIndividualDeleteDialog}
        onOpenChange={setShowIndividualDeleteDialog}
        selectedCount={1}
        names={
          selectedEmployeeForDelete
            ? employeeSelectionName(selectedEmployeeForDelete)
            : ""
        }
        onConfirm={handleIndividualDeleteConfirm}
      />

      {syncRequest && (
        <EmployeeSyncConfirmDialog
          employees={syncRequest.employees}
          onClose={() => setSyncRequest(null)}
          onConfirm={() => {
            if (syncRequest.employees.length === 1 && !syncRequest.retry)
              void handleSyncToDevice(syncRequest.employees[0]);
            else void handleBulkSyncToDevices(syncRequest.retry ?? false);
            setSyncRequest(null);
          }}
        />
      )}

      {cardAssignEmployees && isAdmin && projectId && (
        <BatchCardAssignDialog
          open
          onOpenChange={(next) => {
            if (!next) setCardAssignEmployees(null);
          }}
          projectId={projectId}
          employees={cardAssignEmployees}
        />
      )}

      <EmployeePasswordResetDialog
        isOpen={showPasswordResetDialog}
        onOpenChange={setShowPasswordResetDialog}
        employee={selectedEmployeeForReset}
      />
    </>
  );
}
