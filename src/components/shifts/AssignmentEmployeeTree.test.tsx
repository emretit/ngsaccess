import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName, type FunctionReference } from "convex/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { AssignmentEmployeeTree } from "./AssignmentEmployeeTree";
import type { Employee } from "./lib/planning";

const state = vi.hoisted(() => ({ departments: [] as Doc<"departments">[] }));
vi.mock("convex/react", () => ({ useQuery: (reference: FunctionReference<"query">) => getFunctionName(reference) === "departments:list" ? state.departments : [{ _id: "company", name: "Şirket" }] }));
const projectId = "project" as Id<"projects">;
const parent = { _id: "parent", _creationTime: 0, name: "Üretim", projectId, companyId: "company" } as Doc<"departments">;
const child = { _id: "child", _creationTime: 0, name: "Montaj", projectId, parentId: parent._id } as Doc<"departments">;
const employee = (id: string, firstName: string, departmentId?: Id<"departments">) => ({ _id: id, firstName, lastName: "Test", projectId, departmentId }) as Employee;
const employees = [employee("a", "Ada", parent._id), employee("b", "Bora", child._id), employee("c", "Cem"), employee("d", "Deniz", "removed" as Id<"departments">)];
beforeEach(() => { state.departments = [parent, child]; });

it("renders nested departments and keeps unassigned and removed-department employees selectable", () => {
  const html = renderToStaticMarkup(<AssignmentEmployeeTree projectId={projectId} employees={employees} selectedIds={["b"]} onChange={vi.fn()} />);
  expect(html).toContain("Şirket / Üretim");
  expect(html).toContain("Montaj");
  expect(html).toContain("Departmansız");
  for (const name of ["Ada", "Bora", "Cem", "Deniz"]) expect(html).toContain(`${name} Test`);
  expect(html.indexOf(">Montaj<")).toBeGreaterThan(html.indexOf(">Şirket / Üretim<"));
  expect(html).toContain('aria-expanded="true"');
  expect(html).toContain('aria-label="Tümünü seç"');
  expect(html.match(/checked=""/g)).toHaveLength(2);
});

it("keeps people reachable when legacy department parents form a cycle", () => {
  state.departments = [{ ...parent, parentId: child._id }, child];
  const html = renderToStaticMarkup(<AssignmentEmployeeTree projectId={projectId} employees={employees.slice(0, 2)} selectedIds={[]} onChange={vi.fn()} />);
  expect(html.match(/aria-label="Ada Test"/g)).toHaveLength(1);
  expect(html.match(/aria-label="Bora Test"/g)).toHaveLength(1);
});
