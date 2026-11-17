import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

const callbacks = vi.hoisted(() => ({
  open: undefined as (() => void) | undefined,
  close: undefined as ((event: Event) => void) | undefined,
}));
vi.mock("@/components/ui/alert-dialog", () => {
  const Content = ({ children, onOpenAutoFocus, onCloseAutoFocus }: { children: ReactNode; onOpenAutoFocus: () => void; onCloseAutoFocus: (event: Event) => void }) => {
    callbacks.open = onOpenAutoFocus;
    callbacks.close = onCloseAutoFocus;
    return <div>{children}</div>;
  };
  const Part = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { AlertDialog: Part, AlertDialogContent: Content, AlertDialogAction: Part, AlertDialogCancel: Part,
    AlertDialogHeader: Part, AlertDialogFooter: Part, AlertDialogTitle: Part, AlertDialogDescription: Part };
});
class FocusElement {
  isConnected = true;
  focus = vi.fn();
}
let trigger: FocusElement;
let currentMain: FocusElement | null;
let getElementById: ReturnType<typeof vi.fn<(id: string) => FocusElement | null>>;
beforeEach(() => {
  trigger = new FocusElement();
  currentMain = new FocusElement();
  getElementById = vi.fn((id: string) => id === "main" ? currentMain : null);
  vi.stubGlobal("HTMLElement", FocusElement);
  vi.stubGlobal("document", { activeElement: trigger, getElementById });
  renderToStaticMarkup(<UnsavedChangesDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
  callbacks.open?.();
});
afterEach(() => vi.unstubAllGlobals());
function close() {
  const preventDefault = vi.fn();
  callbacks.close?.({ preventDefault } as unknown as Event);
  return preventDefault;
}

it("returns focus to a connected original trigger as before", () => {
  expect(close()).toHaveBeenCalledOnce();
  expect(trigger.focus).toHaveBeenCalledOnce();
  expect(currentMain?.focus).not.toHaveBeenCalled();
});

it("cancelling after the mobile menu trigger unmounts returns focus to main without scrolling", () => {
  trigger.isConnected = false;
  expect(close()).toHaveBeenCalledOnce();
  expect(currentMain?.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  expect(trigger.focus).not.toHaveBeenCalled();
});

it("discarding resolves the destination main at close time instead of retaining the previous page", () => {
  const previousMain = currentMain;
  trigger.isConnected = false;
  currentMain = new FocusElement();
  expect(close()).toHaveBeenCalledOnce();
  expect(currentMain.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  expect(previousMain?.focus).not.toHaveBeenCalled();
});

it("leaves default Radix fallback available outside the shell when neither target exists", () => {
  trigger.isConnected = false;
  currentMain = null;
  expect(close()).not.toHaveBeenCalled();
});
