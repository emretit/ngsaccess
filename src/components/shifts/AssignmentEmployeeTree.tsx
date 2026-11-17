import { useId, useState } from "react";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { departmentPath } from "@/components/employees/lib/departmentPath";
import { departmentLabels } from "@/lib/departmentLabel";
import { departmentScope, selectionState, toggleSelection } from "@/components/access-control/unified/components/selectionHelpers";
import type { Employee } from "./lib/planning";

export function AssignmentEmployeeTree({ projectId, employees, selectedIds, onChange, error }: {
  projectId: Id<"projects">;
  employees: Employee[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const departments = useQuery(api.departments.list, { projectId });
  const companies = useQuery(api.companies.list, { projectId });
  const prefix = useId();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapsed = (id: string) => setCollapsed(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const labels = departmentLabels(departments, companies);
  const paths = departmentLabels(departments, companies, department => departmentPath(department._id, departments ?? []));
  const query = search.trim().toLocaleLowerCase("tr-TR");
  const visible = employees.filter(employee =>
    `${employee.firstName} ${employee.lastName} ${employee.email ?? ""} ${employee.departmentId ? paths.get(employee.departmentId) ?? "Departmansız" : "Departmansız"}`
      .toLocaleLowerCase("tr-TR").includes(query),
  );
  const change = (ids: string[], checked: boolean) => onChange(toggleSelection(selectedIds, ids, checked));
  const employeeRow = (employee: Employee) => {
    const name = `${employee.firstName} ${employee.lastName}`;
    const id = `${prefix}-employee-${employee._id}`;
    return <li key={employee._id} className="flex items-center gap-2 pl-2 pr-3 text-sm hover:bg-subtle">
      <SelectionCheckbox id={id} label={name} checked={selectedIds.includes(employee._id)} onChange={checked => change([employee._id], checked)} />
      <label htmlFor={id} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center py-1">
        <span className="min-w-0 break-words">{name}{employee.email && <span className="block text-xs text-muted-foreground break-all">{employee.email}</span>}</span>
      </label>
    </li>;
  };
  const renderDepartment = (department: Doc<"departments">, ancestors: Set<string>) => {
    if (ancestors.has(department._id)) return null;
    const scope = departmentScope(departments ?? [], department._id, true);
    const members = visible.filter(employee => employee.departmentId && scope.has(employee.departmentId));
    if (members.length === 0) return null;
    const direct = members.filter(employee => employee.departmentId === department._id);
    const children = departments?.filter(child => child.parentId === department._id) ?? [];
    const label = ancestors.size === 0 ? labels.get(department._id) ?? department.name : department.name;
    const expanded = !collapsed.has(department._id);
    const id = `${prefix}-department-${department._id}`;
    const contentId = `${id}-members`;
    const ids = members.map(employee => employee._id);
    return <li key={department._id}>
      <div className="flex items-center gap-2 border-b bg-subtle/50 pr-3">
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 p-0"
          aria-label={`${label} departmanını ${expanded ? "daralt" : "genişlet"}`} aria-expanded={expanded} aria-controls={contentId}
          onClick={() => toggleCollapsed(department._id)}>
          {expanded ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
        </Button>
        <SelectionCheckbox id={id} label={`${label} departmanındaki çalışanları seç`} checked={selectionState(ids, selectedIds)} onChange={checked => change(ids, checked)} />
        <label htmlFor={id} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 text-sm font-medium">
          <span className="min-w-0 break-words">{label}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">{members.length} kişi</span>
        </label>
      </div>
      <ul id={contentId} hidden={!expanded} className="ml-4 border-l pl-2">
        {direct.map(employeeRow)}
        {children.map(child => renderDepartment(child, new Set([...ancestors, department._id])))}
      </ul>
    </li>;
  };
  const roots = (departments ?? []).filter(department => !department.parentId || !departments?.some(parent => parent._id === department.parentId));
  // Eski, döngülü hiyerarşilerde de çalışanlar seçilebilir kalır.
  const reachable = new Set(roots.flatMap(root => [...departmentScope(departments ?? [], root._id, true)]));
  for (const department of departments ?? []) {
    if (reachable.has(department._id)) continue;
    roots.push(department);
    for (const id of departmentScope(departments ?? [], department._id, true)) reachable.add(id);
  }
  const unassigned = visible.filter(employee => !employee.departmentId || !departments?.some(department => department._id === employee.departmentId));
  const visibleIds = visible.map(employee => employee._id);
  const unassignedId = `${prefix}-unassigned`;
  return <div className="space-y-2">
    <FormFieldWrapper htmlFor={`${prefix}-search`} label="Çalışanlar" error={error}>
      <Input type="search" placeholder="Çalışan veya departman ara" value={search} onChange={event => { setSearch(event.target.value); setCollapsed(new Set()); }} />
    </FormFieldWrapper>
    <div className="max-h-64 overflow-y-auto rounded-md border" role="group" aria-label="Departmanlara göre çalışanlar">
      <label className="sticky top-0 z-10 flex min-h-11 cursor-pointer items-center gap-2 border-b bg-subtle px-3 text-sm">
        <SelectionCheckbox label="Tümünü seç" checked={selectionState(visibleIds, selectedIds)} disabled={visible.length === 0 || departments === undefined}
          onChange={checked => change(visibleIds, checked)} />
        Tümünü seç
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">{selectedIds.length} seçili</span>
      </label>
      {departments === undefined ? <SectionSkeleton rows={2} label="Departmanlar yükleniyor" /> : <ul>
        {roots.map(root => renderDepartment(root, new Set()))}
        {unassigned.length > 0 && <li>
          <div className="flex items-center gap-2 border-b bg-subtle/50 pr-3">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 p-0"
              aria-label={`Departmansız çalışanları ${collapsed.has(unassignedId) ? "genişlet" : "daralt"}`}
              aria-expanded={!collapsed.has(unassignedId)} aria-controls={`${unassignedId}-members`} onClick={() => toggleCollapsed(unassignedId)}>
              {collapsed.has(unassignedId) ? <ChevronRight className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
            </Button>
            <SelectionCheckbox id={unassignedId} label="Departmansız çalışanları seç" checked={selectionState(unassigned.map(employee => employee._id), selectedIds)}
              onChange={checked => change(unassigned.map(employee => employee._id), checked)} />
            <label htmlFor={unassignedId} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 text-sm font-medium">
              Departmansız<span className="text-xs font-normal text-muted-foreground">{unassigned.length} kişi</span>
            </label>
          </div>
          <ul id={`${unassignedId}-members`} hidden={collapsed.has(unassignedId)} className="ml-4 border-l pl-2">{unassigned.map(employeeRow)}</ul>
        </li>}
        {visible.length === 0 && <li className="p-3 text-sm text-muted-foreground">{query ? "Aramayla eşleşen çalışan yok." : "Bu projede çalışan yok."}</li>}
      </ul>}
    </div>
  </div>;
}

function SelectionCheckbox({ id, label, checked, disabled, onChange }: {
  id?: string;
  label: string;
  checked: boolean | "indeterminate";
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return <input id={id} type="checkbox" aria-label={label} className="size-4 shrink-0 accent-primary"
    checked={checked === true} disabled={disabled}
    ref={node => { if (node) node.indeterminate = checked === "indeterminate"; }}
    onChange={event => onChange(event.target.checked)} />;
}
