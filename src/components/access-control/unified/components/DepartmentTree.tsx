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
import { departmentLabels } from "@/lib/departmentLabel";
import {
  departmentScope,
  selectionState,
  toggleSelection,
} from "./selectionHelpers";

interface DepartmentTreeFormData {
  selected_employees: string[];
  department_selections?: { departmentId: string; includeChildren: boolean }[];
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
  const { departments, companies, isLoading: departmentsLoading } = useDepartments();
  const labels = departmentLabels(departments, companies);
  const dynamic = formData.department_selections !== undefined;
  const inheritedDepartments = new Set(formData.department_selections?.flatMap(selection =>
    [...departmentScope(departments, selection.departmentId, selection.includeChildren)]) ?? []);
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
  const renderEmployee = (employee: (typeof employees)[number], root = false) => {
    const id = `${prefix}-employee-${employee._id}`;
    const inherited = !!employee.departmentId && inheritedDepartments.has(employee.departmentId);
    return (
      <div key={employee._id} className={`flex items-center gap-2 py-1 ${root ? "pl-[52px]" : "pl-3"}`}>
        <Checkbox
          id={id}
          checked={inherited || formData.selected_employees.includes(employee._id)}
          disabled={inherited && !formData.selected_employees.includes(employee._id)}
          onCheckedChange={(checked) =>
            change([employee._id], checked === true)
          }
        />
        <Label htmlFor={id} className="flex flex-1 min-h-11 items-center cursor-pointer min-w-0 break-words font-normal">
          {employee.firstName} {employee.lastName}
          {inherited && <span className="ml-1 text-xs text-muted-foreground">· Departmandan</span>}
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
    // Alt departman zaten üstünün altında durur; şirket öneki yalnız kök satırda.
    const label = ancestors.size === 0 ? (labels.get(department._id) ?? department.name) : department.name;
    return (
      <div key={department._id} className="space-y-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-11 w-11 shrink-0"
            aria-label={`${label} departmanını ${open ? "daralt" : "genişlet"}`}
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
            checked={dynamic ? formData.department_selections?.some(selection => selection.departmentId === department._id) : selectionState(
              scopedEmployees.map((employee) => employee._id),
              formData.selected_employees,
            )}
            disabled={!dynamic && scopedEmployees.length === 0}
            onCheckedChange={(checked) =>
              dynamic ? setFormData(prev => ({
                ...prev,
                department_selections: [
                  ...(prev.department_selections ?? []).filter(selection => selection.departmentId !== department._id),
                  ...(checked === true ? [{ departmentId: department._id, includeChildren }] : []),
                ],
              })) : change(
                scopedEmployees.map((employee) => employee._id),
                checked === true,
              )
            }
          />
          <Label htmlFor={id} className="flex flex-1 min-h-11 items-center cursor-pointer min-w-0 break-words">
            {label} ({scopedEmployees.length} kişi)
          </Label>
        </div>
        <div id={contentId} hidden={!open} className="ml-3 border-l pl-2">
          {directEmployees
            .filter(
              (employee) =>
                departmentMatches ||
                matches(`${employee.firstName} ${employee.lastName}`),
            )
            .map((employee) => renderEmployee(employee))}
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
  return (
    <div role="group" aria-label="Kişi seçimi" className="space-y-3 min-w-0">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${prefix}-descendants`}
          checked={includeChildren}
          onCheckedChange={(checked) => {
            setIncludeChildren(checked === true);
            if (dynamic) setFormData(prev => ({ ...prev, department_selections: prev.department_selections?.map(selection => ({ ...selection, includeChildren: checked === true })) }));
          }}
        />
        <Label htmlFor={`${prefix}-descendants`}>
          Alt departmanları dahil et
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        {dynamic ? "Seçili departmanlara sonradan katılanlar da otomatik eklenir. Departmandan ayrılanın yalnız bu yolla gelen yetkisi kaldırılır." : "Seçim anındaki kişiler eklenir. Sonradan katılanlar otomatik eklenmez."}{" "}
        {formData.selected_employees.length} kişi elle seçili.
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
          {visibleOrphans.map((employee) => renderEmployee(employee, true))}
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
