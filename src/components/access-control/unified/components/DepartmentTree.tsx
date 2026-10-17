import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useEmployees } from "@/hooks/useEmployees";
import { useDepartments } from "@/hooks/useDepartments";
import {
  departmentScope,
  selectionState,
  toggleSelection,
} from "./selectionHelpers";

interface DepartmentTreeFormData {
  selected_employees: string[];
}
interface DepartmentTreeProps<T extends DepartmentTreeFormData> {
  formData: T;
  setFormData: (updater: (prev: T) => T) => void;
}

export const DepartmentTree = <T extends DepartmentTreeFormData>({
  formData,
  setFormData,
}: DepartmentTreeProps<T>) => {
  const prefix = useId();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [includeChildren, setIncludeChildren] = useState(true);
  const [search, setSearch] = useState("");
  const { employees, isLoading: employeesLoading } = useEmployees();
  const { departments, isLoading: departmentsLoading } = useDepartments();
  const searchText = search.trim().toLocaleLowerCase("tr");
  const matches = (name: string) =>
    name.toLocaleLowerCase("tr").includes(searchText);
  const change = (ids: string[], checked: boolean) =>
    setFormData((prev) => ({
      ...prev,
      selected_employees: toggleSelection(
        prev.selected_employees,
        ids,
        checked,
      ),
    }));
  const renderEmployee = (employee: (typeof employees)[number]) => {
    const id = `${prefix}-employee-${employee._id}`;
    return (
      <div key={employee._id} className="flex items-center gap-2 py-1 pl-3">
        <Checkbox
          id={id}
          checked={formData.selected_employees.includes(employee._id)}
          onCheckedChange={(checked) =>
            change([employee._id], checked === true)
          }
        />
        <Label htmlFor={id} className="min-w-0 break-words font-normal">
          {employee.firstName} {employee.lastName}
        </Label>
      </div>
    );
  };
  const renderDepartment = (
    department: (typeof departments)[number],
    ancestors: Set<string>,
  ) => {
    if (ancestors.has(department._id)) return null;
    const descendants = departmentScope(departments, department._id, true);
    const scoped = departmentScope(
      departments,
      department._id,
      includeChildren,
    );
    const scopedEmployees = employees.filter(
      (employee) => employee.departmentId && scoped.has(employee.departmentId),
    );
    const directEmployees = employees.filter(
      (employee) => employee.departmentId === department._id,
    );
    const children = departments.filter(
      (child) => child.parentId === department._id,
    );
    const departmentMatches = matches(department.name);
    const hasMatch =
      [...descendants].some((id) =>
        departments.some((dept) => dept._id === id && matches(dept.name)),
      ) ||
      employees.some(
        (employee) =>
          employee.departmentId &&
          descendants.has(employee.departmentId) &&
          matches(`${employee.firstName} ${employee.lastName}`),
      );
    if (searchText && !hasMatch) return null;
    const open = Boolean(searchText) || expanded.has(department._id);
    const contentId = `${prefix}-children-${department._id}`;
    const id = `${prefix}-department-${department._id}`;
    return (
      <div key={department._id} className="space-y-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            aria-label={`${department.name} departmanını ${open ? "daralt" : "genişlet"}`}
            aria-expanded={open}
            aria-controls={contentId}
            onClick={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(department._id)) next.delete(department._id);
                else next.add(department._id);
                return next;
              })
            }
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <Checkbox
            id={id}
            checked={selectionState(
              scopedEmployees.map((employee) => employee._id),
              formData.selected_employees,
            )}
            disabled={scopedEmployees.length === 0}
            onCheckedChange={(checked) =>
              change(
                scopedEmployees.map((employee) => employee._id),
                checked === true,
              )
            }
          />
          <Label htmlFor={id} className="min-w-0 break-words">
            {department.name} ({scopedEmployees.length} kişi)
          </Label>
        </div>
        <div id={contentId} hidden={!open} className="ml-3 border-l pl-2">
          {directEmployees
            .filter(
              (employee) =>
                departmentMatches ||
                matches(`${employee.firstName} ${employee.lastName}`),
            )
            .map(renderEmployee)}
          {children.map((child) =>
            renderDepartment(child, new Set([...ancestors, department._id])),
          )}
        </div>
      </div>
    );
  };
  const roots = departments.filter(
    (department) =>
      !department.parentId ||
      !departments.some((parent) => parent._id === department.parentId),
  );
  const orphanEmployees = employees.filter(
    (employee) =>
      !employee.departmentId ||
      !departments.some(
        (department) => department._id === employee.departmentId,
      ),
  );
  const renderedDepartments = roots.map((department) =>
    renderDepartment(department, new Set()),
  );
  const visibleOrphans = orphanEmployees.filter((employee) =>
    matches(`${employee.firstName} ${employee.lastName}`),
  );
  const hasResults =
    renderedDepartments.some((department) => department !== null) ||
    visibleOrphans.length > 0;
  const allIds = employees.map((employee) => employee._id);
  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Kim erişebilecek?</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto min-h-9 max-w-full whitespace-normal"
          disabled={employeesLoading}
          onClick={() =>
            change(
              allIds,
              selectionState(allIds, formData.selected_employees) !== true,
            )
          }
        >
          {selectionState(allIds, formData.selected_employees) === true
            ? "Projedeki tüm seçimleri kaldır"
            : "Projedeki tüm kişileri seç"}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${prefix}-descendants`}
          checked={includeChildren}
          onCheckedChange={(checked) => setIncludeChildren(checked === true)}
        />
        <Label htmlFor={`${prefix}-descendants`}>
          Alt departmanları dahil et
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Seçim anındaki kişiler eklenir. Sonradan katılanlar otomatik eklenmez.{" "}
        {formData.selected_employees.length} kişi seçili.
      </p>
      <Label htmlFor={`${prefix}-search`} className="sr-only">
        Kişi veya departman ara
      </Label>
      <Input
        id={`${prefix}-search`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Kişi veya departman ara"
      />
      {employeesLoading || departmentsLoading ? (
        <SectionSkeleton rows={3} label="Kişiler yükleniyor" />
      ) : (
        <div className="rounded-md border p-2">
          {renderedDepartments}
          {visibleOrphans.map(renderEmployee)}
          {!hasResults && (
            <EmptyState
              title={
                searchText
                  ? "Aramayla eşleşen kişi veya departman yok"
                  : "Kişi bulunamadı"
              }
            />
          )}
        </div>
      )}
    </div>
  );
};
