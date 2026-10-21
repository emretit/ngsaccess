import type { ReactNode, FormEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { EmployeeTerminateDialog } from "./EmployeeTerminateDialog";
import { EmployeeEmploymentBadge } from "./EmployeeEmploymentBadge";
import type { EmploymentEmployee } from "./lib/employment";
import type { Id } from "../../../convex/_generated/dataModel";
import { createAsyncGuard } from "@/lib/asyncGuard";
const mocks = vi.hoisted(() => ({ terminate: vi.fn(), pending: false, requestClose: undefined as ((open: boolean) => void) | undefined, escape: undefined as ((event: { preventDefault: () => void }) => void) | undefined, outside: undefined as ((event: { preventDefault: () => void }) => void) | undefined, submit: undefined as ((event: FormEvent) => Promise<void>) | undefined }));
vi.mock("convex/react", () => ({ useMutation: () => mocks.terminate }));
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: (action: () => Promise<unknown>) => {
  const guard = createAsyncGuard();
  return { pending: mocks.pending, run: async () => (await guard.run(action)).status === "success" };
} }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: ({ children, onOpenChange }: { children: ReactNode; onOpenChange: (open: boolean) => void }) => { mocks.requestClose = onOpenChange; return <div>{children}</div>; }, DialogContent: ({ children, onEscapeKeyDown, onInteractOutside }: { children: ReactNode; onEscapeKeyDown: typeof mocks.escape; onInteractOutside: typeof mocks.outside }) => { mocks.escape = onEscapeKeyDown; mocks.outside = onInteractOutside; return <div>{children}</div>; }, DialogDescription: Part, DialogFooter: Part, DialogHeader: Part, DialogTitle: Part };
});
vi.mock("react/jsx-dev-runtime", async importOriginal => {
  const actual = await importOriginal<typeof import("react/jsx-dev-runtime")>();
  return { ...actual, jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
    const [type, props] = args;
    if (type === "form" && typeof props === "object" && props !== null && "onSubmit" in props && typeof props.onSubmit === "function") mocks.submit = props.onSubmit as typeof mocks.submit;
    return actual.jsxDEV(...args);
  } };
});
const employee: EmploymentEmployee = { _id: "employee" as Id<"employees">, firstName: "Ada", lastName: "Test", email: "test@example.test", cardNumber: "123", isActive: true };
beforeEach(() => { mocks.terminate.mockReset(); mocks.pending = false; mocks.submit = undefined; });
it("renders the date/type/reason/code form and explains the effect", () => {
  const html = renderToStaticMarkup(<EmployeeTerminateDialog employee={employee} open onOpenChange={() => {}} />);
  expect(html).toContain("Son çalışma günü");
  expect(html).toContain('type="date"');
  expect(html).toContain('maxLength="500"');
  expect(html).toContain('pattern="[0-9]{2}"');
  expect(html).toContain("Bu tarihten sonra kartı tüm cihazlardan silinir");
  expect(html).toContain("PDKS&#x27;te sonraki günler devamsız sayılmaz");
});
it("blocks dismissal and disables submission while pending", () => {
  mocks.pending = true;
  const onOpenChange = vi.fn();
  const html = renderToStaticMarkup(<EmployeeTerminateDialog employee={employee} open onOpenChange={onOpenChange} />);
  mocks.requestClose?.(false);
  expect(onOpenChange).not.toHaveBeenCalled();
  const preventDefault = vi.fn();
  mocks.escape?.({ preventDefault }); mocks.outside?.({ preventDefault });
  expect(preventDefault).toHaveBeenCalledTimes(2);
  expect(html).toContain('<fieldset disabled=""');
  expect(html).toContain("Kaydediliyor");
});
it("renders active/legacy inactive and past/future termination badges", () => {
  const badge = (extra: Partial<EmploymentEmployee>) => renderToStaticMarkup(<EmployeeEmploymentBadge employee={{ ...employee, ...extra }} />);
  expect(badge({})).toContain("Aktif");
  expect(badge({ isActive: false })).toContain("Pasif");
  expect(badge({ employmentEndDate: "2000-10-15" })).toContain("Ayrıldı · 15.10.2000");
  expect(badge({ employmentEndDate: "2099-10-31" })).toContain("Ayrılacak · 31.10.2099");
});

it("guards double submission and closes only after a successful mutation", async () => {
  let release: (() => void) | undefined;
  mocks.terminate.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
  const onOpenChange = vi.fn();
  renderToStaticMarkup(<EmployeeTerminateDialog employee={employee} open onOpenChange={onOpenChange} />);
  const event = { preventDefault: vi.fn() } as unknown as FormEvent;
  const first = mocks.submit?.(event);
  const duplicate = mocks.submit?.(event);
  expect(mocks.terminate).toHaveBeenCalledOnce();
  expect(onOpenChange).not.toHaveBeenCalled();
  release?.();
  await Promise.all([first, duplicate]);
  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  expect(mocks.terminate).toHaveBeenCalledWith(expect.objectContaining({ employeeId: employee._id, terminationType: "resignation" }));
});

it("keeps the dialog open after a mutation error", async () => {
  mocks.terminate.mockRejectedValue(new Error("Erişim reddedildi"));
  const onOpenChange = vi.fn();
  renderToStaticMarkup(<EmployeeTerminateDialog employee={employee} open onOpenChange={onOpenChange} />);
  await mocks.submit?.({ preventDefault: vi.fn() } as unknown as FormEvent);
  expect(mocks.terminate).toHaveBeenCalledOnce();
  expect(onOpenChange).not.toHaveBeenCalled();
});
