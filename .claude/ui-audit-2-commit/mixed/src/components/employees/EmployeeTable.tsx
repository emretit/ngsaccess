import { EmployeeSyncConfirmDialog } from "./EmployeeSyncConfirmDialog";
import { departmentPath } from "./lib/departmentPath";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { errorMessage, notify } from "@/lib/notify";

import { useState } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { Employee } from "@/types/employee";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { useEmployeeTable } from "@/hooks/useEmployeeTable";
import { EmployeeBulkActions } from "./EmployeeBulkActions";
import { EmployeeDeleteDialog } from "./EmployeeDeleteDialog";
import { EmployeePasswordResetDialog } from "./EmployeePasswordResetDialog";
import { RowActions } from "@/components/shared/RowActions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface EmployeeTableProps {
  employees: Employee[];
  sort?: string;
  onSortChange?: (sort: string) => void;
  onEdit: (employee: Employee) => void;
  onViewDetails: (employee: Employee) => void;
  onRefresh?: () => void;
  /** Departman filtresi aktifken sütun her satırda aynı değeri tekrarlar; gizlenir. */
  showDepartment?: boolean;
}

export default function EmployeeTable({
  employees,
  sort = "name:asc",
  onSortChange,
  onEdit,
  onViewDetails,
  onRefresh,
  showDepartment = true,
}: EmployeeTableProps) {
  const { isAdmin, projectId } = useActiveProjectScope();
  const [syncRequest, setSyncRequest] = useState<{ employees: Employee[]; retry?: boolean } | null>(null);
  const [failedSyncIds, setFailedSyncIds] = useState<Id<"employees">[]>([]);
  const [syncReport, setSyncReport] = useState<string[]>([]);
  const [selectedEmployeeForReset, setSelectedEmployeeForReset] =
    useState<Employee | null>(null);
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);
  const [showIndividualDeleteDialog, setShowIndividualDeleteDialog] =
    useState(false);
  const [selectedEmployeeForDelete, setSelectedEmployeeForDelete] =
    useState<Employee | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  const syncEmployeeToDevices = useAction(
    api.actions.hikvisionSync.syncEmployeeToDevices,
  );
  const allDepartments =
    useQuery(api.departments.list, projectId ? { projectId } : "skip") ?? []; // dropdown filter — empty during load is acceptable UX

  const syncAction = useAsyncAction(async (employee: Employee) => {
    const empId = employee._id;
    try {
      const result = await syncEmployeeToDevices({ employeeId: empId });
      setFailedSyncIds(result.failed > 0 ? [empId] : []);
      setSyncReport([
        `${employee.firstName} ${employee.lastName}: ${result.synced} başarılı, ${result.failed} başarısız`,
        ...result.errors.map(errorMessage),
      ]);
      if (result.failed > 0) {
        notify.error(
          "Cihaza gönderilemedi",
          "Teknik ayrıntıları gönderim sonucunda inceleyebilirsiniz.",
        );
      } else if (result.synced > 0) {
        notify.success(
          "Cihaz gönderimi tamamlandı",
          `${employee.firstName} ${employee.lastName} — ${result.synced} cihaza gönderildi.`,
        );
      } else if (result.errors.length > 0) {
        notify.error("Cihaza gönderilemedi", "Teknik ayrıntıları gönderim sonucunda inceleyebilirsiniz.");
      } else {
        notify.info(
          "Bilgi",
          "Bu çalışanın bağlı olduğu cihaz veya kart numarası bulunamadı.",
        );
      }
    } catch (err) {
      setFailedSyncIds([empId]);
      setSyncReport([
        "Cihaza gönderilemedi",
        errorMessage(err),
      ]);
      notify.error("Cihaza gönderilemedi", "Teknik ayrıntıları gönderim sonucunda inceleyebilirsiniz.");
    }
  });
  const handleSyncToDevice = syncAction.run;

  const {
    sortedEmployees,
    selectedEmployees,
    selectedDepartment,
    showDeleteDialog,
    setShowDeleteDialog,
    setSelectedDepartment,
    handleSelectAll,
    handleSelectEmployee,
    handleBulkDelete: originalHandleBulkDelete,
    handleBulkDepartmentUpdate: originalHandleBulkDepartmentUpdate,
    clearSelection,
    departmentPending,
  } = useEmployeeTable(employees);

  const handlePasswordResetClick = (employee: Employee) => {
    setSelectedEmployeeForReset(employee);
    setShowPasswordResetDialog(true);
  };

  const handleIndividualDeleteClick = (employee: Employee) => {
    setSelectedEmployeeForDelete(employee);
    setShowIndividualDeleteDialog(true);
  };

  const removeEmployee = useMutation(api.employees.remove);

  const handleIndividualDeleteConfirm = async () => {
    if (!selectedEmployeeForDelete) return;
    await removeEmployee({ employeeId: selectedEmployeeForDelete._id });
    notify.success("Personel kaydı silindi", "Cihaz temizliği kuyruğa alındı.");
    setShowIndividualDeleteDialog(false);
    setSelectedEmployeeForDelete(null);
    onRefresh?.();
  };

  const handleBulkDelete = async () => {
    await originalHandleBulkDelete();
    onRefresh?.();
  };

  const handleBulkDepartmentUpdate = async () => {
    await originalHandleBulkDepartmentUpdate();
    onRefresh?.();
  };

  const bulkSyncAction = useAsyncAction(async (retry: boolean = false) => {
    setIsBulkSyncing(true);
    let totalSynced = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];

    const failedIds: Id<"employees">[] = [];
    for (const empId of retry ? failedSyncIds : selectedEmployees) {
      try {
        const result = await syncEmployeeToDevices({
          employeeId: empId as Id<"employees">,
        });
        totalSynced += result.synced;
        totalFailed += result.failed;
        if (result.failed > 0) failedIds.push(empId);
        allErrors.push(
          ...result.errors.map(
            (error) =>
              `${employees.find((emp) => emp._id === empId)?.firstName ?? empId}: ${errorMessage(error)}`,
          ),
        );
      } catch (err) {
        totalFailed++;
        failedIds.push(empId);
        allErrors.push(
          `${employees.find((emp) => emp._id === empId)?.firstName ?? empId}: ${errorMessage(err)}`,
        );
      }
    }

    setFailedSyncIds(failedIds);
    setSyncReport([
      `${totalSynced} cihaz başarılı, ${totalFailed} başarısız`,
      ...allErrors,
    ]);
    setIsBulkSyncing(false);

    if (totalSynced > 0) {
      notify.info(
        "Toplu cihaz gönderimi tamamlandı",
        `${totalSynced} cihaza gönderildi${totalFailed > 0 ? `, ${totalFailed} hata` : ""}.`,
      );
    } else if (allErrors.length > 0) {
      notify.error("Cihaza gönderilemedi", "Teknik ayrıntıları gönderim sonucunda inceleyebilirsiniz.");
    } else {
      notify.info("Bilgi", "Seçili çalışanlar için bağlı cihaz bulunamadı.");
    }
  });
  const handleBulkSyncToDevices = bulkSyncAction.run;

  const column = (key: string, label: string, className?: string) => (
    <TableHead
      className={className}
      aria-sort={
        sort.startsWith(`${key}:`)
          ? sort.endsWith(":desc")
            ? "descending"
            : "ascending"
          : "none"
      }
    >
      <button
        type="button"
        className="min-h-9 text-left"
        onClick={() =>
          onSortChange?.(`${key}:${sort === `${key}:asc` ? "desc" : "asc"}`)
        }
      >
        {label}
        {sort.startsWith(`${key}:`)
          ? sort.endsWith(":desc")
            ? " ↓"
            : " ↑"
          : ""}
      </button>
    </TableHead>
  );
  return (
    <div className={isAdmin && selectedEmployees.length > 0 ? "space-y-4 pb-[calc(40vh+2rem)]" : "space-y-4"}>
      {isAdmin && selectedEmployees.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-h-[40vh] overflow-y-auto rounded-md border bg-background shadow-lg md:left-auto md:max-w-3xl">
        <EmployeeBulkActions
          onClear={() => {
            if (!departmentPending && !isBulkSyncing && !syncAction.pending)
              clearSelection();
          }}
          names={employees
            .filter((emp) => selectedEmployees.includes(emp._id))
            .map(
              (emp) =>
                `${emp.firstName} ${emp.lastName} (${emp.payrollCode || "Bordro kodu yok"})`,
            )
            .join(", ")}
          selectedCount={selectedEmployees.length}
          departments={allDepartments.map((d) => ({
            _id: d._id,
            name: departmentPath(d._id, allDepartments),
          }))}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={setSelectedDepartment}
          onUpdateDepartment={handleBulkDepartmentUpdate}
          onDelete={() => setShowDeleteDialog(true)}
          onSyncToDevices={() => {
            setSyncRequest({ employees: employees.filter(emp => selectedEmployees.includes(emp._id)) });
          }}
          isSyncing={isBulkSyncing || syncAction.pending}
          pending={departmentPending || isBulkSyncing || syncAction.pending}
        />
        </div>
      )}

      {syncReport.length > 0 && (
        <div
          role="status"
          className="break-words rounded-md border p-3 text-sm"
        >
          <p className="font-medium">Son cihaz gönderimi sonucu</p>
          <p className="text-muted-foreground">
            Gönderim sonucu cihazda doğrulandığı anlamına gelmez.
          </p>
          <p>{syncReport[0]}</p>
          {syncReport.length > 1 && <details><summary className="cursor-pointer">Teknik ayrıntı</summary>{syncReport.slice(1).map((line, index) => <p key={index}>{line}</p>)}</details>}
          {failedSyncIds.length > 0 && (
            <Button
              disabled={bulkSyncAction.pending}
              onClick={() => {
                setSyncRequest({ employees: employees.filter(emp => failedSyncIds.includes(emp._id)), retry: true });
              }}
            >
              Başarısız kişileri yeniden gönder
            </Button>
          )}
        </div>
      )}
      <div className="min-w-0 overflow-x-auto rounded-md border">
        <Table className="w-full table-fixed text-xs">
          <TableHeader>
            <TableRow className="h-9 bg-muted/50">
              <TableHead className="w-11 px-2">
                <Checkbox
                  aria-label="Bu sayfadaki personeli seç"
                  className="data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:before:absolute data-[state=indeterminate]:before:inset-x-[3px] data-[state=indeterminate]:before:top-1/2 data-[state=indeterminate]:before:h-0.5 data-[state=indeterminate]:before:-translate-y-1/2 data-[state=indeterminate]:before:bg-current data-[state=indeterminate]:before:content-[''] [&[data-state=indeterminate]_svg]:hidden"
                  disabled={
                    !isAdmin ||
                    departmentPending ||
                    isBulkSyncing ||
                    syncAction.pending
                  }
                  checked={
                    employees.length > 0 &&
                    employees.every((emp) =>
                      selectedEmployees.includes(emp._id),
                    )
                      ? true
                      : employees.some((emp) => selectedEmployees.includes(emp._id))
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(checked) => handleSelectAll(checked === true)}
                />
              </TableHead>
              {column("name", "Ad soyad")}
              {column("email", "E-posta", "hidden min-[1100px]:table-cell")}
              {showDepartment &&
                column(
                  "department",
                  "Departman",
                  "hidden min-[760px]:table-cell",
                )}
              {column("position", "Pozisyon", "hidden min-[1100px]:table-cell")}
              {column("card", "Kart no", "hidden min-[760px]:table-cell")}
              {column("status", "Durum", "w-[68px]")}
              <TableHead className="w-11">
                <span className="sr-only">İşlemler</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEmployees.map((employee) => (
              <TableRow key={employee._id} className="h-[42px]">
                <TableCell className="px-2 py-0">
                  <Checkbox
                    aria-label={`${employee.firstName} ${employee.lastName} seç`}
                    disabled={
                      !isAdmin ||
                      departmentPending ||
                      isBulkSyncing ||
                      syncAction.pending
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
                          showDepartment &&
                            (employee.departments?.name ?? "Atanmamış"),
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
                <TableCell className="px-1 py-0">
                  <StatusBadge tone={employee.isActive ? "success" : "neutral"}>
                    {employee.isActive ? "Aktif" : "Pasif"}
                  </StatusBadge>
                </TableCell>
                <TableCell className="px-0 py-0">
                  <div className="max-[759px]:[&_button]:h-11 max-[759px]:[&_button]:w-11">
                    <RowActions
                      label={`${employee.firstName} ${employee.lastName} işlemleri`}
                    >
                      <DropdownMenuItem
                        onSelect={() => onViewDetails(employee)}
                      >
                        Ayrıntı
                      </DropdownMenuItem>
                      {isAdmin && (
                        <>
                          <DropdownMenuItem onSelect={() => onEdit(employee)}>
                            Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={
                              syncAction.pending || bulkSyncAction.pending
                            }
                            onSelect={() => {
                              setSyncRequest({ employees: [employee] });
                            }}
                          >
                            Cihazlara gönder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => handlePasswordResetClick(employee)}
                          >
                            Mobil giriş bağlantısı gönder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() =>
                              handleIndividualDeleteClick(employee)
                            }
                          >
                            Sil
                          </DropdownMenuItem>
                        </>
                      )}
                    </RowActions>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EmployeeDeleteDialog
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedCount={selectedEmployees.length}
        names={employees
          .filter((emp) => selectedEmployees.includes(emp._id))
          .map(
            (emp) =>
              `${emp.firstName} ${emp.lastName} (${emp.payrollCode || "Bordro kodu yok"})`,
          )
          .join(", ")}
        onConfirm={handleBulkDelete}
      />

      <EmployeeDeleteDialog
        isOpen={showIndividualDeleteDialog}
        onOpenChange={setShowIndividualDeleteDialog}
        selectedCount={1}
        names={
          selectedEmployeeForDelete
            ? `${selectedEmployeeForDelete.firstName} ${selectedEmployeeForDelete.lastName} (${selectedEmployeeForDelete.payrollCode || "Bordro kodu yok"})`
            : ""
        }
        onConfirm={handleIndividualDeleteConfirm}
      />

      {syncRequest && <EmployeeSyncConfirmDialog employees={syncRequest.employees} onClose={() => setSyncRequest(null)} onConfirm={() => {
        if (syncRequest.employees.length === 1 && !syncRequest.retry) void handleSyncToDevice(syncRequest.employees[0]);
        else void handleBulkSyncToDevices(syncRequest.retry ?? false);
        setSyncRequest(null);
      }} />}

      <EmployeePasswordResetDialog
        isOpen={showPasswordResetDialog}
        onOpenChange={setShowPasswordResetDialog}
        employee={selectedEmployeeForReset}
      />
    </div>
  );
}
