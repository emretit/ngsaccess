import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../convex/_generated/dataModel";
import EmployeeTable from "./EmployeeTable";
const mocks = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0, selected: [] as string[], items: [] as { children?: ReactNode; onSelect?: () => void }[], sync: vi.fn(), confirm: undefined as (() => void) | undefined, bulkSend: undefined as (() => void) | undefined }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (initial: unknown) => { const i = mocks.cursor++; if (!(i in mocks.states)) mocks.states[i] = initial; return [mocks.states[i], (next: unknown) => { mocks.states[i] = next; }]; } }));
vi.mock("convex/react", () => ({ useQuery: () => [], useAction: () => mocks.sync, useMutation: () => vi.fn() }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p", isAdmin: true }) }));
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: (run: unknown) => ({ run, pending: false }) }));
vi.mock("@/hooks/useEmployeeTable", () => ({ useEmployeeTable: (employees: Employee[]) => ({ sortedEmployees: employees, selectedEmployees: mocks.selected, selectedDepartment: "", handleSelectAll: vi.fn(), handleSelectEmployee: vi.fn(), clearSelection: vi.fn() }) }));
vi.mock("@/components/shared/RowActions", () => ({ RowActions: ({ children }: { children?: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/ui/dropdown-menu", () => ({ DropdownMenuItem: (props: { children?: ReactNode; onSelect?: () => void }) => { mocks.items.push(props); return <div>{props.children}</div>; } }));
vi.mock("./EmployeeDeleteDialog", () => ({ EmployeeDeleteDialog: () => null }));
vi.mock("./EmployeePasswordResetDialog", () => ({ EmployeePasswordResetDialog: () => null }));
vi.mock("./EmployeeBulkActions", () => ({ EmployeeBulkActions: ({ onSyncToDevices }: { onSyncToDevices: () => void }) => { mocks.bulkSend = onSyncToDevices; return <div>Toplu işlemler</div>; } }));
vi.mock("./EmployeeSyncConfirmDialog", () => ({ EmployeeSyncConfirmDialog: ({ onConfirm }: { onConfirm: () => void }) => { mocks.confirm = onConfirm; return <div>Gönderim onayı</div>; } }));
const employee: Employee = { _id: "e" as Id<"employees">, firstName: "Ada", lastName: "Test", email: "ada@test.test", cardNumber: "1", isActive: true };
function render(employees = [employee]) { mocks.cursor = 0; mocks.items = []; return renderToStaticMarkup(<EmployeeTable employees={employees} onEdit={() => {}} onViewDetails={() => {}} />); }
beforeEach(() => { vi.clearAllMocks(); mocks.states = []; mocks.selected = []; mocks.confirm = undefined; mocks.sync.mockResolvedValue({ synced: 1, failed: 0, errors: [] }); });
it("02-O2: row send opens confirmation and calls device action only after confirmation", () => {
  render();
  mocks.items.find(item => item.children === "Cihazlara gönder")?.onSelect?.();
  expect(mocks.sync).not.toHaveBeenCalled();
  expect(render()).toContain("Gönderim onayı");
  mocks.confirm?.();
  expect(mocks.sync).toHaveBeenCalledWith({ employeeId: "e" });
});
it("02-D8: selection reserves enough bottom space for the largest toolbar", () => {
  mocks.selected = ["e"];
  const html = render();
  expect(html).toContain('class="fixed bottom-4 left-4 right-4');
  expect(html).toContain("Toplu işlemler");
  expect(html).toContain("pb-[calc(40vh+2rem)]");
  mocks.selected = [];
  expect(render()).not.toContain("pb-[calc(40vh+2rem)]");
});
it("02-O4/D6: checkboxes retain shared neutral border and expanded target without overriding pseudo-element", () => {
  const html = render();
  expect(html.match(/border-input after:absolute after:-inset-1.5/g)).toHaveLength(2);
  expect(html).not.toContain("data-[state=indeterminate]:after:inset");
  expect(html).toContain('w-11 px-2"');
});

it("02-O2: bulk send also waits for confirmation", async () => {
  const employees = [employee, { ...employee, _id: "e2" as Id<"employees"> }];
  mocks.selected = ["e", "e2"];
  render(employees);
  mocks.bulkSend?.();
  expect(mocks.sync).not.toHaveBeenCalled();
  render(employees);
  mocks.confirm?.();
  await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledTimes(2));
});
it("02-O3: result report keeps raw SDK errors in closed technical details", () => {
  mocks.states = [null, [], ["Cihaza gönderilemedi", "NET_DVR_SendRemoteConfig failed: 17"]];
  const html = render();
  expect(html).toMatch(/<details><summary[^>]*>Teknik ayrıntı<\/summary><p>NET_DVR_SendRemoteConfig failed: 17<\/p><\/details>/);
});
