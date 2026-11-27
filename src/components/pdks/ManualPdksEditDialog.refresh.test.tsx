import { renderToStaticMarkup } from "react-dom/server";
import type { FormEvent, ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ManualPdksEditDialog } from "./ManualPdksEditDialog";
import { PDKS_INVALIDATED, pdksEpoch } from "@/lib/pdksInvalidation";
import type { Id } from "../../../convex/_generated/dataModel";
const state = vi.hoisted(() => ({ cursor: 0, submit: null as null | ((event: FormEvent<HTMLFormElement>) => void), mutation: vi.fn() }));
vi.mock("react", async original => {
  const react = await original<typeof import("react")>();
  return { ...react, useState: <T,>(initial: T) => {
    const index = state.cursor++;
    return [index === 2 ? "Eksik kayıt düzeltmesi" as T : initial, vi.fn()];
  } };
});
vi.mock("convex/react", () => ({ useMutation: () => state.mutation }));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn() }, errorMessage: () => "Kaydedilemedi" }));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({ useUnsavedChangesGuard: () => ({ requestClose: vi.fn() }) }));
vi.mock("@/components/shared/FormDialog", () => ({ FormDialog: ({ children, onSubmit }: { children: ReactNode; onSubmit: typeof state.submit }) => { state.submit = onSubmit; return <div>{children}</div>; } }));
afterEach(() => { vi.unstubAllGlobals(); state.cursor = 0; state.mutation.mockReset(); });
it("successful manual mutation invalidates both table and payroll after persistence completes", async () => {
  const target = new EventTarget();
  vi.stubGlobal("window", target);
  const table = vi.fn(), payroll = vi.fn();
  target.addEventListener(PDKS_INVALIDATED, table);
  target.addEventListener(PDKS_INVALIDATED, payroll);
  let complete: (() => void) | undefined;
  state.mutation.mockReturnValue(new Promise<void>(resolve => { complete = resolve; }));
  const close = vi.fn(), epoch = pdksEpoch();
  renderToStaticMarkup(<ManualPdksEditDialog open employeeId={"employee" as Id<"employees">} employeeName="Ada" date="2026-06-01" initialEntry="08:00" initialExit="17:00" onClose={close} />);
  state.submit?.({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
  expect(table).not.toHaveBeenCalled();
  complete?.();
  await Promise.resolve(); await Promise.resolve();
  expect(table).toHaveBeenCalledOnce();
  expect(payroll).toHaveBeenCalledOnce();
  expect(pdksEpoch()).toBe(epoch + 1);
  expect(close).toHaveBeenCalledOnce();
});
