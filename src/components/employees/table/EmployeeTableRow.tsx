import { usePermissions } from "@/hooks/usePermissions";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { EmploymentEmployee as Employee } from "../lib/employment";
import { EmployeeEmploymentBadge } from "../EmployeeEmploymentBadge";
import { EmployeeBiometricsCell, type EmployeeBiometrics } from "./EmployeeBiometricsCell";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { RowActions } from "@/components/shared/RowActions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
interface Props {
  employee: Employee;
  canManage: boolean;
  departmentPending: boolean;
  isBulkSyncing: boolean;
  syncPending: boolean;
  bulkSyncPending: boolean;
  selectedEmployees: Id<"employees">[];
  handleSelectEmployee: (checked: boolean, id: Id<"employees">) => void;
  onViewDetails: (employee: Employee) => void;
  showDepartment: boolean;
  /** undefined = kolon gizli (yönetici değil). */
  biometrics?: EmployeeBiometrics | null;
  onSync: (employee: Employee) => void;
  handlePasswordResetClick: (employee: Employee) => void;
  handleIndividualDeleteClick: (employee: Employee) => void;
}
export function EmployeeTableRow({
  employee,
  canManage,
  departmentPending,
  isBulkSyncing,
  syncPending,
  bulkSyncPending,
  selectedEmployees,
  handleSelectEmployee,
  onViewDetails,
  showDepartment,
  biometrics,
  onSync,
  handlePasswordResetClick,
  handleIndividualDeleteClick,
}: Props) {
  const { can } = usePermissions();
  const canSync = can("accessRules.manage");
  return (
    <TableRow className="h-[42px]">
      <TableCell className="px-2 py-0">
        <Checkbox
          aria-label={`${employee.firstName} ${employee.lastName} seç`}
          disabled={
            !(canManage || canSync) || departmentPending || isBulkSyncing || syncPending
          }
          checked={selectedEmployees.includes(employee._id)}
          onCheckedChange={(checked) =>
            handleSelectEmployee(checked === true, employee._id)
          }
        />
      </TableCell>
      <TableCell className="px-2 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="hidden h-7 w-7 shrink-0 min-[760px]:flex">
            <AvatarImage src={employee.photoUrl ?? ""} alt="" />
            <AvatarFallback>
              {employee.firstName[0]}
              {employee.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <button
              type="button"
              className="max-w-full truncate text-left font-medium hover:underline"
              onClick={() => onViewDetails(employee)}
            >
              {employee.firstName} {employee.lastName}
            </button>
            <p className="truncate text-[11px] text-muted-foreground min-[760px]:hidden">
              {[
                showDepartment && (employee.departments?.name ?? "Atanmamış"),
                employee.payrollCode,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden truncate min-[1100px]:table-cell">
        {employee.email}
      </TableCell>
      {showDepartment && (
        <TableCell className="hidden truncate min-[760px]:table-cell">
          {employee.departments?.name ?? "Atanmamış"}
        </TableCell>
      )}
      <TableCell className="hidden truncate min-[1100px]:table-cell">
        {employee.positions?.name ?? "—"}
      </TableCell>
      <TableCell className="hidden truncate tabular-nums min-[760px]:table-cell">
        {employee.cardNumber || "—"}
      </TableCell>
      {biometrics !== undefined && (
        <TableCell className="hidden px-2 py-0 min-[760px]:table-cell">
          <EmployeeBiometricsCell biometrics={biometrics ?? undefined} />
        </TableCell>
      )}
      <TableCell className="px-1 py-0">
        <EmployeeEmploymentBadge employee={employee} />
      </TableCell>
      <TableCell className="px-0 py-0">
        <div className="max-[759px]:[&_button]:h-11 max-[759px]:[&_button]:w-11">
          <RowActions
            label={`${employee.firstName} ${employee.lastName} işlemleri`}
          >
            <DropdownMenuItem onSelect={() => onViewDetails(employee)}>
              {canManage ? "Düzenle" : "Ayrıntı"}
            </DropdownMenuItem>
            {canSync && (<>
                <DropdownMenuItem
                  disabled={syncPending || bulkSyncPending}
                  onSelect={() => {
                    onSync(employee);
                  }}
                >
                  Cihazlara gönder
                </DropdownMenuItem>
            </>)}
            {canManage && (
              <>
                <DropdownMenuItem
                  onSelect={() => handlePasswordResetClick(employee)}
                >
                  Mobil giriş bağlantısı gönder
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onSelect={() => handleIndividualDeleteClick(employee)}
                >
                  Sil
                </DropdownMenuItem>
              </>
            )}
          </RowActions>
        </div>
      </TableCell>
    </TableRow>
  );
}
