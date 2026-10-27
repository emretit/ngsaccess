import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";

const state = vi.hoisted(() => ({
  index: 0,
  confirm: false,
  runId: null as string | null,
  select: undefined as (() => void) | undefined,
  send: undefined as (() => Promise<void>) | undefined,
  start: vi.fn(),
  total: 3,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: () => {
    const index = state.index++;
    return [
      index === 0 ? state.confirm : state.runId,
      (value: boolean | string | null) => {
        if (index === 0 && typeof value === "boolean") state.confirm = value;
        else if (typeof value === "string" || value === null)
          state.runId = value;
      },
    ];
  },
}));
vi.mock("convex/react", () => ({
  useQuery: () => ({ total: state.total, brands: { hikvision: state.total } }),
  useAction: () => state.start,
}));
vi.mock("@/hooks/useAsyncAction", () => ({
  useAsyncAction: (action: () => Promise<void>) => ({
    run: action,
    pending: false,
  }),
}));
vi.mock("@/components/ui/dropdown-menu", () => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    DropdownMenu: Wrapper,
    DropdownMenuTrigger: Wrapper,
    DropdownMenuContent: Wrapper,
    DropdownMenuItem: ({
      children,
      onSelect,
      disabled,
    }: {
      children: ReactNode;
      onSelect: () => void;
      disabled: boolean;
    }) => {
      state.select = disabled ? undefined : onSelect;
      return <button disabled={disabled}>{children}</button>;
    },
  };
});
vi.mock("@/components/shared/ConfirmAction", () => ({
  ConfirmAction: ({
    open,
    description,
    onConfirm,
  }: {
    open: boolean;
    description: ReactNode;
    onConfirm: () => Promise<void>;
  }) => {
    state.send = open ? onConfirm : undefined;
    return open ? <section aria-label="Onay">{description}</section> : null;
  },
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: () => null,
  SheetContent: () => null,
  SheetHeader: () => null,
  SheetTitle: () => null,
  SheetDescription: () => null,
}));
import { ProjectSyncButton } from "./SyncRuns";
const render = () => {
  state.index = 0;
  return renderToStaticMarkup(
    <ProjectSyncButton projectId={"project" as Id<"projects">} />,
  );
};
beforeEach(() => {
  state.confirm = false;
  state.runId = null;
  state.total = 3;
  state.start.mockReset().mockResolvedValue({ runId: "run" });
});
it("menü seçimi onayı açar, yalnız onaydan sonra proje gönderimini başlatır", async () => {
  expect(render()).toContain("Diğer işlemler");
  expect(state.send).toBeUndefined();
  expect(state.start).not.toHaveBeenCalled();
  state.select?.();
  expect(render()).toContain("3 cihaz · tüm proje · filtreler uygulanmaz");
  expect(state.start).not.toHaveBeenCalled();
  await state.send?.();
  expect(state.start).toHaveBeenCalledExactlyOnceWith({ projectId: "project" });
  expect(state.runId).toBe("run");
});
it("hedef cihaz yokken gönderim menü öğesini devre dışı bırakır", () => {
  state.total = 0;
  render();
  expect(state.select).toBeUndefined();
  expect(state.start).not.toHaveBeenCalled();
});
