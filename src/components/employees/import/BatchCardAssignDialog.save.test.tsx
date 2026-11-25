import type { ReactNode, ChangeEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { BatchCardAssignDialog } from "./BatchCardAssignDialog";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../../convex/_generated/dataModel";

const mocks = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0, assign: vi.fn(),
  save: undefined as (() => void) | undefined,
  inputs: new Map<string, (event: ChangeEvent<HTMLInputElement>) => void>(),
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states)) mocks.states[index] = typeof initial === "function" ? initial() : initial;
    return [mocks.states[index], (next: unknown) => {
      mocks.states[index] = typeof next === "function" ? next(mocks.states[index]) : next;
    }];
  },
}));
vi.mock("convex/react", () => ({ useMutation: () => mocks.assign, useAction: () => vi.fn(), useQuery: () => undefined }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("@/hooks/useDevices", () => ({ useDevices: () => ({ devices: [] }) }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: Part, DialogContent: Part, DialogDescription: Part, DialogHeader: Part, DialogTitle: Part };
});
vi.mock("@/components/ui/button", () => ({ Button: (props: { children?: ReactNode; onClick?: () => void }) => {
  if (props.children === "Kaydet") mocks.save = props.onClick;
  return <button>{props.children}</button>;
} }));
vi.mock("@/components/ui/input", () => ({ Input: (props: { "aria-label": string; value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) => {
  mocks.inputs.set(props["aria-label"], props.onChange);
  return <input aria-label={props["aria-label"]} value={props.value} readOnly />;
} }));

const person = (id: string, cardNumber: string): Employee => ({
  _id: id as Id<"employees">, firstName: id, lastName: "Kişi", email: "", cardNumber,
});
const employees = [person("first", ""), person("second", "  "), person("already", "987")];
function render() {
  mocks.cursor = 0;
  mocks.inputs.clear();
  return renderToStaticMarkup(<BatchCardAssignDialog open onOpenChange={() => {}} projectId={"project" as Id<"projects">} employees={employees} />);
}
function fill(id: string, value: string) {
  const onChange = mocks.inputs.get(`${id} Kişi kart numarası`);
  if (!onChange) throw new Error("Missing card input");
  onChange({ target: { value } } as ChangeEvent<HTMLInputElement>);
}
beforeEach(() => { mocks.states = []; mocks.cursor = 0; mocks.assign.mockReset(); });

it("only assigns selected cardless people and retries failed rows without resubmitting assigned cards", async () => {
  render();
  expect(mocks.inputs.size).toBe(2);
  fill("first", "00123");
  fill("second", "456");
  render();
  mocks.assign.mockResolvedValueOnce([
    { employeeId: "first", status: "assigned", message: "Kart atandı" },
    { employeeId: "second", status: "error", message: "Kart kullanımda" },
  ]);
  mocks.save?.();
  await vi.waitFor(() => expect(mocks.assign).toHaveBeenCalledOnce());
  expect(mocks.assign).toHaveBeenLastCalledWith({ assignments: [
    { employeeId: "first", cardNumber: "00123" }, { employeeId: "second", cardNumber: "456" },
  ] });
  expect(render()).toContain("Kart kullanımda");
  fill("second", "789");
  render();
  mocks.assign.mockResolvedValueOnce([{ employeeId: "second", status: "assigned", message: "Kart atandı" }]);
  mocks.save?.();
  await vi.waitFor(() => expect(mocks.assign).toHaveBeenCalledTimes(2));
  expect(mocks.assign).toHaveBeenLastCalledWith({ assignments: [{ employeeId: "second", cardNumber: "789" }] });
  expect(render()).toContain("Atanan: 2");
});
