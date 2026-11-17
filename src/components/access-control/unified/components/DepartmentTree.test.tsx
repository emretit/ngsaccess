import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DepartmentTree } from "./DepartmentTree";

vi.mock("@/hooks/useEmployees", () => ({ useEmployees: () => ({ employees: [{ _id: "employee", firstName: "Ada", lastName: "Test", departmentId: "department" }], isLoading: false }) }));
vi.mock("@/hooks/useDepartments", () => ({ useDepartments: () => ({ departments: [{ _id: "department", name: "A" }, { _id: "empty", name: "Boş" }], companies: [], isLoading: false }) }));

type Form = { selected_employees: string[]; department_selections: { departmentId: string; includeChildren: boolean }[] };
type Props = { children?: ReactNode; id?: string; checked?: boolean; disabled?: boolean; onCheckedChange?: (value: boolean) => void };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}

describe("dynamic department selection", () => {
  it("saves an explicit department instead of a snapshot of its people", () => {
    let form: Form = { selected_employees: [], department_selections: [] };
    let tree: ReactNode;
    function Harness() {
      tree = DepartmentTree({ formData: form, setFormData: update => { form = update(form); } });
      return tree;
    }
    const html = renderToStaticMarkup(<Harness />);
    expect(html).toContain("sonradan katılanlar da otomatik eklenir");
    const checkbox = nodes(tree).find(node => node.props.id?.endsWith("-department-department"));
    checkbox?.props.onCheckedChange?.(true);
    expect(form.department_selections).toEqual([{ departmentId: "department", includeChildren: true }]);
    expect(form.selected_employees).toEqual([]);
    renderToStaticMarkup(<Harness />);
    const person = nodes(tree).find(node => node.props.id?.endsWith("-employee-employee"));
    expect(person?.props.checked).toBe(true);
    expect(person?.props.disabled).toBe(true);
  });

  it("permits selecting an empty department for future staff", () => {
    let form: Form = { selected_employees: [], department_selections: [] };
    let tree: ReactNode;
    function Harness() { tree = DepartmentTree({ formData: form, setFormData: update => { form = update(form); } }); return tree; }
    renderToStaticMarkup(<Harness />);
    const empty = nodes(tree).find(node => node.props.id?.endsWith("-department-empty"));
    expect(empty?.props.disabled).toBe(false);
    empty?.props.onCheckedChange?.(true);
    expect(form.department_selections).toEqual([{ departmentId: "empty", includeChildren: true }]);
  });
});
