import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DepartmentTree from "@/components/departments/DepartmentTree";
import SlideOverPanel from "@/components/employees/SlideOverPanel";
import type { Employee } from "@/types/employee";
import EmployeeTable from "@/components/employees/EmployeeTable";
import { EmployeeStats } from "@/components/employees/EmployeeStats";
import { EmployeeFilters } from "@/components/employees/EmployeeFilters";
import { EmployeePagination } from "@/components/employees/EmployeePagination";
import { useEmployees } from "@/hooks/useEmployees";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { DeviceSyncStatusBanner } from "@/components/sync/DeviceSyncStatusBanner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import {
  clampPage,
  filterAndSortEmployees,
  safeSearchParam,
} from "@/components/employees/lib/employeeList";
export default function Employees() {
  const { projectId } = useActiveProjectScope();
  return (
    <QuerySectionBoundary
      resetKey={projectId}
      title="Personel listesi yüklenemedi"
      description="Bağlantınızı kontrol edip yeniden deneyin."
    >
      <EmployeePage />
    </QuerySectionBoundary>
  );
}
function EmployeePage() {
  const {
    isAdmin,
    projectId,
    loading: projectLoading,
  } = useActiveProjectScope();
  const { activeProject } = useActiveProject();
  const { employees, isLoading, refetch, hasProjectAccess } = useEmployees();
  const [params, setParams] = useSearchParams();
  const [privateQuery, setPrivateQuery] = useState<string | null>(null);
  const q = privateQuery ?? safeSearchParam(params.get("q") ?? "");
  const department = params.get("department") ?? "";
  const status = ["active", "inactive"].includes(params.get("status") ?? "")
    ? (params.get("status") ?? "all")
    : "all";
  const requestedSort = params.get("sort") ?? "name:asc";
  const sort = /^(name|email|department|position|card|status):(asc|desc)$/.test(
    requestedSort,
  )
    ? requestedSort
    : "name:asc";
  const size = [10, 25, 50, 100].includes(Number(params.get("size")))
    ? Number(params.get("size"))
    : 10;
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const previousProject = useRef(projectId);
  const filtered = useMemo(
    () => filterAndSortEmployees(employees, q, department, status, sort),
    [employees, q, department, status, sort],
  );
  const page = clampPage(
    Number(params.get("page") ?? 1),
    filtered.length,
    size,
  );
  const update = (values: Record<string, string>, reset = true) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(values)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (reset) next.set("page", "1");
        return next;
      },
      { replace: true },
    );
  useEffect(() => {
    if (previousProject.current === projectId) return;
    previousProject.current = projectId;
    setPrivateQuery(null);
    setParams({}, { replace: true });
    // The panel owns the project-change dirty guard and retains its draft until confirmed.
  }, [projectId, setParams]);
  useEffect(() => {
    const rawQuery = params.get("q") ?? "";
    if (
      !isLoading &&
      (params.get("page") !== String(page) ||
        rawQuery !== safeSearchParam(rawQuery))
    )
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("page", String(page));
          if (rawQuery !== safeSearchParam(rawQuery)) next.delete("q");
          return next;
        },
        { replace: true },
      );
  }, [page, isLoading, params, setParams]);
  const close = () => {
    setIsPanelOpen(false);
    setEditingEmployee(null);
    setViewMode(false);
  };
  const open = (employee: Employee | null, detail: boolean) => {
    setEditingEmployee(employee);
    setViewMode(detail);
    setIsPanelOpen(true);
  };
  if ((projectLoading || isLoading) && !isPanelOpen)
    return <SectionSkeleton label="Personel bilgileri yükleniyor…" />;
  if (!hasProjectAccess)
    return (
      <AccessDenied message="Bu projenin personel kayıtlarını görüntüleme yetkiniz yok." />
    );
  if (!projectId)
    return <EmptyState title="Personelleri görmek için proje seçin." />;
  const hasFilters = !!q || !!department || status !== "all";
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Kişiler"
        scope={activeProject?.name}
        primaryAction={
          isAdmin
            ? { label: "Personel ekle", onClick: () => open(null, false) }
            : undefined
        }
      />
      <EmployeeStats
        loading={isLoading || projectLoading}
        employees={employees}
      />
      <DeviceSyncStatusBanner />
      <div className="flex min-w-0 flex-col gap-6 min-[1100px]:flex-row min-[1100px]:gap-12">
        <DepartmentTree
          selectedValue={department}
          onSelectUnassigned={() => update({ department: "unassigned" })}
          onSelectDepartment={(id) => update({ department: id ?? "" })}
        />
        <div className="min-w-0 flex-1 space-y-4">
          <EmployeeFilters
            searchQuery={q}
            onSearchChange={(value) => {
              setPrivateQuery(safeSearchParam(value) !== value ? value : null);
              update({ q: safeSearchParam(value) });
            }}
            itemsPerPage={size}
            onItemsPerPageChange={(value) => update({ size: String(value) })}
            status={status}
            onStatusChange={(value) => update({ status: value })}
            sort={sort}
            onSortChange={(value) => update({ sort: value })}
            hasFilters={hasFilters}
            onClear={() => {
              setPrivateQuery(null);
              update({ q: "", department: "", status: "" });
            }}
          />
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? "Personel bilgileri yükleniyor…"
              : `${filtered.length} sonuç · Seçim yalnız bu sayfayı kapsar.`}
          </p>
          {isLoading ? (
            <SectionSkeleton label="Personel bilgileri yükleniyor…" />
          ) : employees.length === 0 ? (
            <EmptyState
              title="Henüz personel eklenmedi"
              description={`${activeProject?.name ?? "Bu proje"} için ilk personel kaydını oluşturun.`}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Aramanızla eşleşen personel yok"
              description="Aramayı veya departman seçimini değiştirin."
              action={{
                label: "Filtreleri temizle",
                onClick: () => {
                  setPrivateQuery(null);
                  update({ q: "", department: "", status: "" });
                },
              }}
            />
          ) : (
            <EmployeeTable
              key={`${projectId}/${q}/${department}/${status}/${sort}/${page}/${size}`}
              sort={sort}
              onSortChange={(value) => update({ sort: value })}
              employees={filtered.slice((page - 1) * size, page * size)}
              onEdit={(employee) => open(employee, false)}
              onDelete={() => undefined}
              onViewDetails={(employee) => open(employee, true)}
              onRefresh={refetch}
            />
          )}
          <EmployeePagination
            currentPage={page}
            totalPages={Math.ceil(filtered.length / size)}
            onPageChange={(value) => update({ page: String(value) }, false)}
          />
        </div>
      </div>
      <SlideOverPanel
        isOpen={isPanelOpen}
        onClose={close}
        employee={editingEmployee}
        viewMode={viewMode}
        onSave={() => {
          if (viewMode) setViewMode(false);
          else {
            refetch();
            close();
          }
        }}
      />
    </div>
  );
}
