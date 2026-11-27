import { PageTemplate } from "@/components/shared/PageTemplate";
import { usePermissions } from "@/hooks/usePermissions";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, usePaginatedQuery, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { notify } from "@/lib/notify";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import DepartmentTree from "@/components/departments/DepartmentTree";
import type { Id } from "../../convex/_generated/dataModel";
import SlideOverPanel from "@/components/employees/SlideOverPanel";
import type { Employee } from "@/types/employee";
import EmployeeTable from "@/components/employees/EmployeeTable";
import { EmployeeFilters } from "@/components/employees/EmployeeFilters";
import { PaginationBar, pageRange } from "@/components/shared/PaginationBar";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { EmployeeAddMenu } from "@/components/employees/EmployeeAddMenu";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import {
  clampPage,
  filterAndSortEmployees,
  employeeDepartmentScope,
  safeSearchParam,
} from "@/components/employees/lib/employeeList";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmployeeImportDialog } from "@/components/employees/import/EmployeeImportDialog";
import { EmployeeExportDialog } from "@/components/employees/import/EmployeeExportDialog";
import { EMPLOYEE_EXPORT_MAX_ROWS } from "@/lib/employees/exportEmployeesXlsx";
import { downloadEmployeeImportTemplate } from "@/lib/employees/importTemplate";
export default function Employees() {
  const { projectId, activeProject } = useActiveProjectScope();
  const { can, loading } = usePermissions();
  if (loading) return <PageTemplate title="Kişiler"><SectionSkeleton label="Personel bilgileri yükleniyor…" /></PageTemplate>;
  if (!can("employees.view")) return <PageTemplate title="Kişiler"><AccessDenied message="Personel görüntüleme yetkiniz yok. Proje yöneticinizle iletişime geçin." /></PageTemplate>;
  return (
    <QuerySectionBoundary
      resetKey={projectId}
      title="Personel listesi yüklenemedi"
      description="Bağlantınızı kontrol edip yeniden deneyin."
      renderFallback={retry => <PageTemplate title="Kişiler" scope={activeProject?.name}>
        <ErrorState title="Personel listesi yüklenemedi" description="Bağlantınızı kontrol edip yeniden deneyin." compact onRetry={retry} />
      </PageTemplate>}
    >
      <EmployeePage />
    </QuerySectionBoundary>
  );
}
function EmployeePage() {
  const { projectId,
    loading: projectLoading } = useActiveProjectScope();
  const { can } = usePermissions();
  const canManage = can("employees.manage");
  const canExport = can("reports.view");
  const { activeProject } = useActiveProject();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const convex = useConvex();
  const [exportEmployees, setExportEmployees] = useState<Employee[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const refetch = () => {};
  const hasProjectAccess = can("employees.view");
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [privateQuery, setPrivateQuery] = useState<string | null>(null);
  const q = privateQuery ?? safeSearchParam(params.get("q") ?? "");
  const department = params.get("department") ?? "";
  const company = params.get("company") ?? "";
  const status = ["active", "inactive", "terminated"].includes(params.get("status") ?? "")
    ? (params.get("status") ?? "all")
    : "all";
  const requestedSort = params.get("sort") ?? "name:asc";
  const sort = /^(name|email|company|department|position|card|status):(asc|desc)$/.test(
    requestedSort,
  )
    ? requestedSort
    : "name:asc";
  const size = [10, 25, 50, 100].includes(Number(params.get("size")))
    ? Number(params.get("size"))
    : 10;
  const includeChildren = params.get("children") === "1";
  const departments = useQuery(api.departments.list, projectId ? { projectId } : "skip");
  const summary = useQuery(api.employees.listSummary, projectId ? { projectId } : "skip");
  const legacyMode = summary?.modeToken.startsWith("legacy:") ?? false;
  const legacyRows = useQuery(api.employees.list, projectId && legacyMode ? { projectId } : "skip");
  const queryKey = JSON.stringify([projectId, q, department, company, status, sort, includeChildren, size, summary?.modeToken]);
  const [navigation, setNavigation] = useState<{ key: string; cursor: string | null; previous: (string | null)[] }>({ key: "", cursor: null, previous: [] });
  const currentNavigation = navigation.key === queryKey ? navigation : { key: queryKey, cursor: null, previous: [] };
  const { results: windows, status: paginationStatus } = usePaginatedQuery(
    api.employees.listPageWindow,
    projectId && summary && !legacyMode ? { projectId, search: q, department, company, status, sort, includeChildren, modeToken: summary.modeToken, pageSize: size, startCursor: currentNavigation.cursor } : "skip",
    { initialNumItems: 1 },
  );
  const window = windows[0];
  const employees = useMemo(() => (legacyMode ? legacyRows : window?.page) ?? [], [legacyMode, legacyRows, window]);
  const isLoading = projectLoading || summary === undefined || (legacyMode ? legacyRows === undefined : paginationStatus === "LoadingFirstPage");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [continuingEmployeeId, setContinuingEmployeeId] = useState<Id<"employees"> | null>(null);
  const continuingLookup = useQuery(
    api.employees.getById,
    continuingEmployeeId ? { employeeId: continuingEmployeeId } : "skip",
  );
  useEffect(() => {
    if (!continuingEmployeeId) return;
    const next = employees.find(employee => employee._id === continuingEmployeeId) ?? continuingLookup;
    if (next === undefined) return;
    setContinuingEmployeeId(null);
    if (next !== null) setEditingEmployee(next);
    else {
      setIsPanelOpen(false);
      notify.error("Personel ayrıntısı açılamadı", "Kayıt listede bulunamadı; silinmiş olabilir.");
    }
  }, [employees, continuingEmployeeId, continuingLookup]);
  useEffect(() => {
    const state: unknown = location.state;
    if (!state || typeof state !== "object" || !("transferEmployeeId" in state) || !("transferProjectId" in state) || state.transferProjectId !== projectId || isLoading) return;
    const target = employees.find(item => item._id === state.transferEmployeeId);
    if (target) setEditingEmployee(target);
    else if (typeof state.transferEmployeeId === "string") setContinuingEmployeeId(state.transferEmployeeId as Id<"employees">);
    setIsPanelOpen(true);
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, projectId, isLoading, employees, navigate]);
  const previousProject = useRef(projectId);
  const filtered = useMemo(() => legacyMode
    ? filterAndSortEmployees(employees, q, department, status, sort, { company, departmentIds: employeeDepartmentScope(department, includeChildren, departments ?? []) })
    : employees, [legacyMode, employees, q, department, status, sort, company, includeChildren, departments]);
  const page = legacyMode ? clampPage(Number(params.get("page") ?? 1), filtered.length, size) : currentNavigation.previous.length + 1;
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
    setContinuingEmployeeId(null);
  };
  const open = (employee: Employee | null) => {
    setEditingEmployee(employee);
    setIsPanelOpen(true);
  };
  if (projectLoading && !isPanelOpen)
    return <PageTemplate title="Kişiler" scope={activeProject?.name}><SectionSkeleton label="Personel bilgileri yükleniyor…" /></PageTemplate>;
  if (!hasProjectAccess)
    return (
      <PageTemplate title="Kişiler" scope={activeProject?.name}><AccessDenied message="Bu projenin personel kayıtlarını görüntüleme yetkiniz yok." /></PageTemplate>
    );
  if (!projectId)
    return <PageTemplate title="Kişiler"><EmptyState title="Personelleri görmek için proje seçin." /></PageTemplate>;
  const hasFilters = !!q || !!department || !!company || includeChildren || status !== "all";
  const statusCounts = summary?.counts ?? null;
  const prepareExport = async () => {
    setExportLoading(true);
    setExportError(null);
    try {
      // Export is explicit: it does not keep an all-person subscription open with the list.
      const all = legacyRows ?? await convex.query(api.employees.list, { projectId });
      const departmentIds = employeeDepartmentScope(department, includeChildren, departments ?? []);
      const rows = filterAndSortEmployees(all, q, department, status, sort, { company, departmentIds });
      if (rows.length > EMPLOYEE_EXPORT_MAX_ROWS) throw new Error(`Dışa aktarma en fazla ${EMPLOYEE_EXPORT_MAX_ROWS} kişi içerebilir.`);
      setExportEmployees(rows);
      setExportDialogOpen(true);
    } catch (cause: unknown) {
      setExportError(cause instanceof Error ? cause.message : "Dışa aktarma hazırlanamadı.");
    } finally { setExportLoading(false); }
  };
  return (
    <PageTemplate
      title="Kişiler"
      scope={activeProject?.name}
      primaryAction={canManage && <EmployeeAddMenu onAddNew={() => open(null)} />}
      secondaryActions={(canManage || canExport) && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="min-h-11 gap-1.5 md:min-h-8">İşlemler<ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canManage && <DropdownMenuItem onSelect={() => setImportDialogOpen(true)}>İçe aktar</DropdownMenuItem>}
          {canExport && <DropdownMenuItem disabled={exportLoading} onSelect={() => void prepareExport()}>Dışa aktar</DropdownMenuItem>}
          {canManage && <DropdownMenuItem onSelect={() => void downloadEmployeeImportTemplate().catch((cause: unknown) => setExportError(cause instanceof Error ? cause.message : "Şablon indirilemedi."))}>Şablon indir</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>}
      notice={exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}
      aside={{ label: "Şirket ve departman kapsamı", content: <><DepartmentTree
          selectedValue={department}
          selectedCompany={company}
          onSelectDepartment={(id) => update({ department: id ?? "", company: "" })}
          onSelectCompany={(id) => update({ company: id, department: "" })}
        /><label className="flex min-h-11 items-center gap-2 px-3 text-sm"><input type="checkbox" checked={includeChildren} onChange={event => update({ children: event.target.checked ? "1" : "" })} />Alt departmanları dahil et</label></> }}
      filters={
        <EmployeeFilters
          searchQuery={q}
          onSearchChange={(value) => {
            setPrivateQuery(safeSearchParam(value) !== value ? value : null);
            update({ q: safeSearchParam(value) });
          }}
          status={status}
          statusCounts={statusCounts}
          onStatusChange={(value) => update({ status: value })}
          sort={sort}
          onSortChange={(value) => update({ sort: value })}
          hasFilters={hasFilters}
          onClear={() => {
            setPrivateQuery(null);
            update({ q: "", department: "", company: "", status: "", children: "" });
          }}
        />
      }
      footer={
        <PaginationBar
          summary={legacyMode ? filtered.length === 0 ? "0 sonuç" : `${employees.length} personelden ${filtered.length} sonuç · ${pageRange(filtered.length, page, size)} gösteriliyor` : `${statusCounts ? `${statusCounts.all} personel · ` : ""}${filtered.length} kişi gösteriliyor`}
          page={page}
          pageCount={legacyMode ? Math.max(1, Math.ceil(filtered.length / size)) : window?.isDone ? page : undefined}
          previousDisabled={isLoading || page <= 1}
          nextDisabled={isLoading || (legacyMode ? page * size >= filtered.length : window?.isDone !== false)}
          nextLabel={!legacyMode && filtered.length < size && window?.isDone === false ? "Devam" : "Sonraki"}
          onPrevious={() => {
            if (legacyMode) { update({ page: String(page - 1) }, false); return; }
            const previous = [...currentNavigation.previous];
            const cursor = previous.pop() ?? null;
            setNavigation({ key: queryKey, cursor, previous });
            update({ page: String(page - 1) }, false);
          }}
          onNext={() => {
            if (legacyMode) { update({ page: String(page + 1) }, false); return; }
            if (!window || window.isDone) return;
            setNavigation({ key: queryKey, cursor: window.continueCursor, previous: [...currentNavigation.previous, currentNavigation.cursor] });
            update({ page: String(page + 1) }, false);
          }}
          pageSize={size}
          pageSizes={[10, 25, 50, 100]}
          onPageSizeChange={(value) => update({ size: String(value) })}
          pageSizeLabel="Sayfadaki personel sayısı"
        />
      }
      overlays={<>
        <SlideOverPanel
          isOpen={isPanelOpen}
          onClose={close}
          employee={editingEmployee}
          loadingEmployee={continuingEmployeeId !== null}
          onContinue={({ employeeId }) => {
            refetch();
            const saved = employees.find(item => item._id === employeeId);
            if (saved) setEditingEmployee(saved);
            else setContinuingEmployeeId(employeeId);
          }}
          onSave={() => {
            refetch();
            if (!editingEmployee) close();
          }}
        />
        {importDialogOpen && canManage && <EmployeeImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} projectId={projectId} />}
        {exportDialogOpen && canExport && <EmployeeExportDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} projectId={projectId} employees={exportEmployees} onError={setExportError} />}
      </>}
    >
      <EmployeeTable
        key={`${projectId}/${q}/${department}/${company}/${status}/${sort}/${includeChildren}/${page}/${size}`}
        loading={isLoading}
        emptyState={
          statusCounts?.all === 0 && !hasFilters ? (
            <EmptyState
              title="Henüz personel eklenmedi"
              description={`${activeProject?.name ?? "Bu proje"} için ilk personel kaydını oluşturun.`}
            />
          ) : (
            <EmptyState
              title={
                q
                  ? "Aramanızla eşleşen personel yok"
                  : department && status === "all"
                    ? "Bu departmanda doğrudan bağlı kişi yok"
                    : company && status === "all"
                      ? "Bu şirkette kişi yok"
                      : "Seçili filtrelerle eşleşen personel yok"
              }
              description={window?.isDone === false ? "Henüz yüklenen kayıtlarda eşleşme yok. Aramayı sürdürmek için Devam düğmesini kullanın." : "Aramayı veya şirket ve departman seçimini değiştirin."}
              action={{
                label:
                  (department || company) &&
                  !q &&
                  status === "all"
                    ? "Tüm personele dön"
                    : "Filtreleri temizle",
                onClick: () => {
                  setPrivateQuery(null);
                  update({
                    q: "",
                    department: "",
                    company: "",
                    status: "",
                  });
                },
              }}
            />
          )
        }
        sort={sort}
        onSortChange={(value) => update({ sort: value })}
        showDepartment={!department}
        showCompany={
          !company && !department && employees.some((item) => item.companies)
        }
        employees={legacyMode ? filtered.slice((page - 1) * size, page * size) : filtered}
        onViewDetails={(employee) => open(employee)}
        onRefresh={refetch}
      />
    </PageTemplate>
  );
}
