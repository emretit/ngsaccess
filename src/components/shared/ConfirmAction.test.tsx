import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmAction } from "./ConfirmAction";
import { ConfirmDestructive } from "./ConfirmDestructive";

const state = vi.hoisted(() => ({
  pending: false,
  error: vi.fn(),
  button: undefined as
    | undefined
    | { onClick: () => Promise<void>; disabled: boolean },
  root: undefined as undefined | { onOpenChange: (open: boolean) => void },
  content: undefined as
    | undefined
    | {
        onOpenAutoFocus: () => void;
        onEscapeKeyDown: (event: { preventDefault: () => void }) => void;
        onCloseAutoFocus: (event: { preventDefault: () => void }) => void;
      },
}));
vi.mock("@/lib/notify", () => ({
  notify: { error: state.error, success: vi.fn() },
}));
vi.mock("@/hooks/useAsyncAction", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/hooks/useAsyncAction")>();
  return {
    useAsyncAction: (...args: Parameters<typeof original.useAsyncAction>) => {
      const action = original.useAsyncAction(...args);
      return { ...action, pending: state.pending || action.pending };
    },
  };
});
vi.mock("@/components/ui/alert-dialog", () => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    AlertDialog: (props: {
      children: ReactNode;
      onOpenChange: (open: boolean) => void;
    }) => {
      state.root = props;
      return <>{props.children}</>;
    },
    AlertDialogContent: (
      props: NonNullable<typeof state.content> & { children: ReactNode },
    ) => {
      state.content = props;
      return <>{props.children}</>;
    },
    AlertDialogHeader: Wrapper,
    AlertDialogTitle: Wrapper,
    AlertDialogDescription: Wrapper,
    AlertDialogFooter: Wrapper,
    AlertDialogCancel: ({
      children,
      disabled,
    }: {
      children: ReactNode;
      disabled: boolean;
    }) => <button disabled={disabled}>{children}</button>,
  };
});
vi.mock("@/components/ui/button", () => ({
  Button: (
    props: NonNullable<typeof state.button> & {
      children: ReactNode;
      variant?: string;
    },
  ) => {
    state.button = props;
    return (
      <button
        disabled={props.disabled}
        data-variant={props.variant ?? "default"}
      >
        {props.children}
      </button>
    );
  },
}));
beforeEach(() => {
  state.pending = false;
  state.error.mockClear();
  state.button = undefined;
});
function render(onConfirm: () => Promise<unknown>) {
  const onOpenChange = vi.fn();
  const html = renderToStaticMarkup(
    <ConfirmAction
      open
      onOpenChange={onOpenChange}
      title="Gönderilsin mi?"
      description={<p>Açıklama</p>}
      confirmLabel="Gönder"
      pendingLabel="Gönderiliyor…"
      errorTitle="Gönderilemedi"
      onConfirm={onConfirm}
    />,
  );
  return { html, onOpenChange, click: () => state.button?.onClick() };
}
describe("ConfirmAction", () => {
  it("uses the primary button and closes only after the promise succeeds", async () => {
    let finish: (() => void) | undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { html, click, onOpenChange } = render(onConfirm);
    expect(html).toContain('data-variant="default"');
    expect(html).toContain("Açıklama");
    const first = click();
    await click();
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
    finish?.();
    await first;
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("keeps a handled false result open without a second toast", async () => {
    const { click, onOpenChange } = render(async () => false);
    await click();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(state.error).not.toHaveBeenCalled();
  });
  it("keeps a rejected action open and reports exactly one error", async () => {
    const error = new Error("offline");
    const { click, onOpenChange } = render(async () => {
      throw error;
    });
    await click();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalledExactlyOnceWith("Gönderilemedi", error);
  });
  it("returns focus to the connected opener", () => {
    class FocusTarget {
      isConnected = true;
      focus = vi.fn();
    }
    const target = new FocusTarget();
    vi.stubGlobal("HTMLElement", FocusTarget);
    vi.stubGlobal("document", { activeElement: target });
    try {
      render(async () => undefined);
      state.content?.onOpenAutoFocus();
      const preventDefault = vi.fn();
      state.content?.onCloseAutoFocus({ preventDefault });
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(target.focus).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("preserves the destructive variant and object/effects description", () => {
    const html = renderToStaticMarkup(
      <ConfirmDestructive
        open
        onOpenChange={vi.fn()}
        title="Silinsin mi?"
        objectName="Bölge"
        effects={["İlişkiler kaldırılır"]}
        confirmLabel="Sil"
        onConfirm={async () => undefined}
      />,
    );
    expect(html).toContain('data-variant="destructive"');
    expect(html).toContain('class="font-medium text-foreground">Bölge');
    expect(html).toContain("<li>İlişkiler kaldırılır</li>");
    expect(html).toContain(">Sil</button>");
  });
  it("locks Escape and cancellation and shows the pending label", () => {
    state.pending = true;
    const { html, onOpenChange } = render(async () => undefined);
    const preventDefault = vi.fn();
    state.root?.onOpenChange(false);
    state.content?.onEscapeKeyDown({ preventDefault });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain("Gönderiliyor…");
  });
});
