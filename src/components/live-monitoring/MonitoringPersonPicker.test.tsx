import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { MonitoringPersonPicker } from "./MonitoringPersonPicker";
const mocks = vi.hoisted(() => ({ effects: [] as (() => unknown)[], term: undefined as string | undefined, people: undefined as { _id: string; firstName: string; lastName: string }[] | undefined }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: (effect: () => unknown) => { mocks.effects.push(effect); } }));
vi.mock("convex/react", () => ({ useQuery: () => mocks.people }));
vi.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: (value: string) => mocks.term ?? value }));
vi.mock("@/components/ui/popover", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Popover: Part, PopoverContent: Part, PopoverTrigger: Part };
});
vi.mock("@/components/ui/command", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Command: Part, CommandList: Part, CommandEmpty: Part, CommandItem: Part, CommandInput: () => null };
});
beforeEach(() => { mocks.effects = []; mocks.people = undefined; mocks.term = undefined; });
it("clears unavailable or foreign person filters only after the project lookup finishes", () => {
  const change = vi.fn();
  const render = () => { mocks.effects = []; renderToStaticMarkup(<MonitoringPersonPicker projectId={"p" as Id<"projects">} value="unavailable" allowClear onChange={change} />); mocks.effects.forEach(effect => effect()); };
  render(); expect(change).not.toHaveBeenCalled();
  mocks.people = []; render(); expect(change).toHaveBeenCalledExactlyOnceWith(null);
});
it("retains an available selected person and never clears an assignment picker implicitly", () => {
  const change = vi.fn();
  mocks.people = [{ _id: "employee", firstName: "Ada", lastName: "Test" }];
  renderToStaticMarkup(<MonitoringPersonPicker projectId={"p" as Id<"projects">} value="employee" allowClear onChange={change} />);
  mocks.effects.forEach(effect => effect()); expect(change).not.toHaveBeenCalled();
  mocks.effects = []; mocks.people = [];
  renderToStaticMarkup(<MonitoringPersonPicker projectId={"p" as Id<"projects">} value="missing" onChange={change} />);
  mocks.effects.forEach(effect => effect()); expect(change).not.toHaveBeenCalled();
});

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, loading: false }) }));

it("shows one loading or empty status even when the clear option exists", () => {
  const render = () => renderToStaticMarkup(<MonitoringPersonPicker projectId={"p" as Id<"projects">} value="" allowClear onChange={vi.fn()} />);
  let markup = render();
  expect(markup).toContain('role="status"');
  expect(markup).toContain("Aranıyor…");
  expect(markup).not.toContain("Kişi bulunamadı");
  mocks.people = [];
  markup = render();
  expect(markup).toContain("Kişi bulunamadı");
  expect(markup).not.toContain("Aranıyor…");
  expect(markup).toContain("Tüm kişiler");
  mocks.term = "pending";
  markup = render();
  expect(markup).toContain("Aranıyor…");
  expect(markup).not.toContain("Kişi bulunamadı");
});

it("marks the stored person or the empty clear option as selected", () => {
  mocks.people = [{ _id: "employee", firstName: "Ada", lastName: "Test" }];
  const render = (value: string) => renderToStaticMarkup(<MonitoringPersonPicker projectId={"p" as Id<"projects">} value={value} allowClear onChange={vi.fn()} />);
  for (const value of ["", "employee"]) {
    const markup = render(value);
    expect(markup.match(/class="sr-only">Seçili/g)).toHaveLength(1);
    expect(markup).not.toContain('role="status"');
  }
});
