import { usePermissions } from "@/hooks/usePermissions";
import { EmployeeSelectAll } from "./table/EmployeeSelectAll";
import { EmployeeSortColumn } from "./table/EmployeeSortColumn";
import { departmentPath } from "./lib/departmentPath";
import { departmentLabels } from "@/lib/departmentLabel";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { errorMessage, notify } from "@/lib/notify";
import { useMemo, useState } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { EmploymentEmployee as Employee } from "./lib/employment";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { useEmployeeTable } from "@/hooks/useEmployeeTable";
import { EmployeeTableRow } from "./table/EmployeeTableRow";
import { EmployeeTableDialogs } from "./table/EmployeeTableDialogs";
import { EmployeeTableBulkSelection } from "./table/EmployeeTableBulkSelection";
import {
  selectedEmployeeNames,
  employeeSelectionState,
} from "./table/employeeTableModel";
interface EmployeeTableProps {
  employees: Employee[];
  sort?: string;
  onSortChange?: (sort: string) => void;
  onViewDetails: (employee: Employee) => void;
  onRefresh?: () => void;
  /** Departman filtresi aktifken sütun her satırda aynı değeri tekrarlar; gizlenir. */
  showDepartment?: boolean;
  /** Şirket filtresi aktifken veya projede hiç şirket yokken gizlenir. */
  showCompany?: boolean;
}

export default function EmployeeTable({
  employees,
  sort = "name:asc",
  onSortChange,
  onViewDetails,
  onRefresh,
  showDepartment = true,
  showCompany = false,
}: EmployeeTableProps) {
  const { projectId } = useActiveProjectScope();
  const { can } = usePermissions();
  const canManage = can("employees.manage");
  const canSelect = canManage || can("accessRules.manage");
  const canSeeBiometrics = can("biometrics.manage");
  const [syncRequest, setSyncRequest] = useState<{
    employees: Employee[];
    retry?: boolean;
  } | null>(null);
  const [failedSyncIds, setFailedSyncIds] = useState<Id<"employees">[]>([]);
  const [syncReport, setSyncReport] = useState<string[]>([]);
  // Diyalog açıldığı andaki seçim; canlı filtre her render'da yeni dizi üretip diyalogun efektini sıfırlar.
  const [cardAssignEmployees, setCardAssignEmployees] = useState<
    Employee[] | null
  >(null);
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
  const biometricRows = useQuery(
    api.employeeBiometrics.summary,
    can("biometrics.manage") && projectId ? { projectId } : "skip",
  );
  const biometricsByEmployee = useMemo(
    () => new Map((biometricRows ?? []).map((row) => [row.employeeId, row])),
    [biometricRows],
  );
  const allDepartments =
    useQuery(api.departments.list, projectId ? { projectId } : "skip") ?? []; // dropdown filter — empty during load is acceptable UX
  const companies = useQuery(api.companies.list, projectId ? { projectId } : "skip");
  const departmentNames = departmentLabels(allDepartments, companies, (d) => departmentPath(d._id, allDepartments));

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
        notify.error(
          "Cihaza gönderilemedi",
          "Teknik ayrıntıları gönderim sonucunda inceleyebilirsiniz.",
        );
      } else {
        notify.info(
          "Bilgi",
          "Bu çalışanın bağlı olduğu cihaz veya kart numarası bulunamadı.",
        );
      }
    } catch (err) {
      setFailedSyncIds([empId]);
      setSyncReport(["Cihaza gönderilemedi", errorMessage(err)]);
      notify.error(
        "Cihaza gönderilemedi",
        "Teknik ayrıntıları gönderim sonucunda inceleyebilirsiniz.",
      );
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
      notify.error(
        "Cihaza gönderilemedi",
        "Teknik ayrıntıları gönderim sonucunda inceleyebilirsiniz.",
      );
    } else {
      notify.info("Bilgi", "Seçili çalışanlar için bağlı cihaz bulunamadı.");
    }
  });
  const handleBulkSyncToDevices = bulkSyncAction.run;

  const column = (key: string, label: string, className?: string) => (
    <EmployeeSortColumn
      columnKey={key}
      label={label}
      className={className}
      sort={sort}
      onSortChange={onSortChange}
    />
  );
  return (
    <div
      className={
        canSelect && selectedEmployees.length > 0
          ? "space-y-4 pb-[calc(40vh+2rem)]"
          : "space-y-4"
      }
    >
      {canSelect && selectedEmployees.length > 0 && (
        <EmployeeTableBulkSelection
          onClear={() => {
            if (!departmentPending && !isBulkSyncing && !syncAction.pending)
              clearSelection();
          }}
          names={selectedEmployeeNames(employees, selectedEmployees)}
          selectedCount={selectedEmployees.length}
          departments={allDepartments.map((d) => ({
            _id: d._id,
            name: departmentNames.get(d._id) ?? d.name,
          }))}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={setSelectedDepartment}
          onUpdateDepartment={handleBulkDepartmentUpdate}
          onDelete={() => setShowDeleteDialog(true)}
          onSyncToDevices={() => {
            setSyncRequest({
              employees: employees.filter((emp) =>
                selectedEmployees.includes(emp._id),
              ),
            });
          }}
          onAssignCards={() =>
            setCardAssignEmployees(
              employees.filter((emp) => selectedEmployees.includes(emp._id)),
            )
          }
          isSyncing={isBulkSyncing || syncAction.pending}
          pending={departmentPending || isBulkSyncing || syncAction.pending}
        />
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
          {syncReport.length > 1 && (
            <details>
              <summary className="cursor-pointer">Teknik ayrıntı</summary>
              {syncReport.slice(1).map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </details>
          )}
          {failedSyncIds.length > 0 && (
            <Button
              disabled={bulkSyncAction.pending}
              onClick={() => {
                setSyncRequest({
                  employees: employees.filter((emp) =>
                    failedSyncIds.includes(emp._id),
                  ),
                  retry: true,
                });
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
              <EmployeeSelectAll
                disabled={
                  !canSelect ||
                  departmentPending ||
                  isBulkSyncing ||
                  syncAction.pending
                }
                checked={employeeSelectionState(employees, selectedEmployees)}
                onSelectAll={handleSelectAll}
              />
              {column("name", "Ad soyad")}
              {column("email", "E-posta", "hidden min-[1100px]:table-cell")}
              {showCompany &&
                column("company", "Şirket", "hidden min-[1100px]:table-cell")}
              {showDepartment &&
                column(
                  "department",
                  "Departman",
                  "hidden min-[760px]:table-cell",
                )}
              {column("position", "Pozisyon", "hidden min-[1100px]:table-cell")}
              {column("card", "Kart no", "hidden min-[760px]:table-cell")}
              {canSeeBiometrics && (
                <TableHead className="hidden w-[96px] min-[760px]:table-cell">
                  Biyometrik
                </TableHead>
              )}
              {column("status", "Durum", "w-[180px]")}
              <TableHead className="w-11">
                <span className="sr-only">İşlemler</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEmployees.map((employee) => (
              <EmployeeTableRow
                key={employee._id}
                employee={employee}
                canManage={canManage}
                departmentPending={departmentPending}
                isBulkSyncing={isBulkSyncing}
                syncPending={syncAction.pending}
                bulkSyncPending={bulkSyncAction.pending}
                selectedEmployees={selectedEmployees}
                handleSelectEmployee={handleSelectEmployee}
                onViewDetails={onViewDetails}
                showDepartment={showDepartment}
                showCompany={showCompany}
                biometrics={
                  canSeeBiometrics
                    ? (biometricsByEmployee.get(employee._id) ?? null)
                    : undefined
                }
                onSync={(employee) => setSyncRequest({ employees: [employee] })}
                handlePasswordResetClick={handlePasswordResetClick}
                handleIndividualDeleteClick={handleIndividualDeleteClick}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <EmployeeTableDialogs
        showDeleteDialog={showDeleteDialog}
        setShowDeleteDialog={setShowDeleteDialog}
        selectedEmployees={selectedEmployees}
        employees={employees}
        handleBulkDelete={handleBulkDelete}
        showIndividualDeleteDialog={showIndividualDeleteDialog}
        setShowIndividualDeleteDialog={setShowIndividualDeleteDialog}
        selectedEmployeeForDelete={selectedEmployeeForDelete}
        handleIndividualDeleteConfirm={handleIndividualDeleteConfirm}
        syncRequest={syncRequest}
        setSyncRequest={setSyncRequest}
        handleSyncToDevice={handleSyncToDevice}
        handleBulkSyncToDevices={handleBulkSyncToDevices}
        cardAssignEmployees={cardAssignEmployees}
        canManage={canManage}
        projectId={projectId}
        setCardAssignEmployees={setCardAssignEmployees}
        showPasswordResetDialog={showPasswordResetDialog}
        setShowPasswordResetDialog={setShowPasswordResetDialog}
        selectedEmployeeForReset={selectedEmployeeForReset}
      />
    </div>
  );
}
