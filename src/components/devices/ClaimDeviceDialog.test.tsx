import type { InputHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { ClaimDeviceDialog } from "./ClaimDeviceDialog";

const mocks = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0,
  select: [] as ((value: string) => void)[],
  inputs: new Map<string, InputHTMLAttributes<HTMLInputElement>>(),
  submit: async () => {}, claim: vi.fn(),
  hasUser: true, hasPassword: true, empty: false,
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [mocks.states[index], (value: unknown) => { mocks.states[index] = value; }];
  },
  useEffect: () => {},
}));
vi.mock("convex/react", () => ({
  useMutation: () => mocks.claim,
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref) === "adminDevices:listForClaim"
    ? mocks.empty ? [] : [{ _id: "pool", name: "IDE", brand: "ide_smart", hasIdeUser: mocks.hasUser, hasIdePassword: mocks.hasPassword }]
    : [],
}));
vi.mock("@/hooks/useProjectAccess", () => ({ useProjectAccess: () => ({ isSuperAdmin: false }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "project", activeProject: { name: "Proje" } }) }));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({ useUnsavedChangesGuard: () => ({ requestClose: vi.fn(), dialog: null }) }));
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: (submit: () => Promise<void>) => {
  mocks.submit = submit;
  return { run: submit, pending: false };
} }));
vi.mock("@/components/ui/sheet", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Sheet: Part, SheetContent: Part, SheetHeader: Part, SheetTitle: Part };
});
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children?: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/ui/select", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Select: ({ children, onValueChange }: { children?: ReactNode; onValueChange: (value: string) => void }) => {
    mocks.select.push(onValueChange);
    return <div>{children}</div>;
  }, SelectContent: Part, SelectTrigger: Part, SelectItem: Part, SelectValue: Part };
});
vi.mock("@/components/shared/FormFieldWrapper", () => ({ FormFieldWrapper: ({ children, htmlFor }: {
  children: ReactNode | ((props: { id: string }) => ReactNode); htmlFor: string;
}) => <div>{typeof children === "function" ? children({ id: htmlFor }) : children}</div> }));
vi.mock("@/components/ui/input", () => ({ Input: (props: InputHTMLAttributes<HTMLInputElement>) => {
  if (props.id) mocks.inputs.set(props.id, props);
  return <input {...props} />;
} }));
vi.mock("@/components/shared/PasswordField", () => ({ PasswordField: (props: InputHTMLAttributes<HTMLInputElement>) => {
  if (props.id) mocks.inputs.set(props.id, props);
  return <input {...props} />;
} }));
function render() {
  mocks.cursor = 0;
  mocks.select = [];
  mocks.inputs.clear();
  return renderToStaticMarkup(<ClaimDeviceDialog open onClose={vi.fn()} onSuccess={vi.fn()} />);
}
beforeEach(() => {
  mocks.states = [null, "project", "", false, 4, "", "", "zone", ""];
  mocks.empty = false;
  mocks.hasUser = true;
  mocks.hasPassword = true;
  mocks.claim.mockReset();
});
it("CIH-02: pool credentials are not requested or submitted, and the user sees their source", async () => {
  render();
  mocks.select[0]("pool");
  const html = render();
  expect(html).toContain("Havuzdaki panel bilgileri kullanılacak");
  expect(mocks.inputs.has("claim-user")).toBe(false);
  expect(mocks.inputs.has("claim-password")).toBe(false);
  await mocks.submit();
  expect(mocks.claim).toHaveBeenCalledWith({ adminDeviceId: "pool", projectId: "project", name: "IDE", ideDoorCount: 4, zoneId: "zone" });
});
it("CIH-02: only missing pool fields require manual entry", async () => {
  mocks.hasPassword = false;
  render();
  mocks.select[0]("pool");
  render();
  expect(mocks.inputs.has("claim-user")).toBe(false);
  expect(mocks.inputs.get("claim-password")?.value).toBe("");
  await expect(mocks.submit()).rejects.toThrow("geçerli");
  expect(mocks.claim).not.toHaveBeenCalled();
  // Simulate the input setter used by the rendered password control.
  mocks.states[6] = " manual-password ";
  render();
  await mocks.submit();
  expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({ idePassword: "manual-password" }));
  expect(mocks.claim.mock.calls[0][0]).not.toHaveProperty("ideUser");
});
it("CIH-02: changing the selected device clears manually entered credentials", () => {
  mocks.hasUser = false;
  mocks.hasPassword = false;
  mocks.states[5] = "previous-user";
  mocks.states[6] = "previous-secret";
  render();
  mocks.select[0]("pool");
  render();
  expect(mocks.inputs.get("claim-user")?.value).toBe("");
  expect(mocks.inputs.get("claim-password")?.value).toBe("");
});

it("CIH-02: an empty reservation list explains how a device becomes available", () => {
  mocks.empty = true;
  const html = render();
  expect(html).toContain("Projenize ayrılmış cihaz yok.");
  expect(html).toContain("Sistem yöneticisi cihazı projenize ayırdığında burada görünür.");
});
