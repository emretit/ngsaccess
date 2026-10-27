import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormDialog } from "./FormDialog";

const state = vi.hoisted(() => ({
  root: undefined as undefined | { onOpenChange: (open: boolean) => void },
  content: undefined as
    | undefined
    | {
        onEscapeKeyDown: (event: { preventDefault: () => void }) => void;
        onInteractOutside: (event: { preventDefault: () => void }) => void;
        onCloseAutoFocus: (event: { preventDefault: () => void }) => void;
      },
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: (props: {
    children: ReactNode;
    onOpenChange: (open: boolean) => void;
  }) => {
    state.root = props;
    return <>{props.children}</>;
  },
  DialogContent: (
    props: NonNullable<typeof state.content> & {
      children: ReactNode;
      className: string;
      "aria-busy": boolean;
    },
  ) => {
    state.content = props;
    return (
      <div className={props.className} aria-busy={props["aria-busy"]}>
        {props.children}
      </div>
    );
  },
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <header>{children}</header>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
beforeEach(() => {
  state.root = undefined;
  state.content = undefined;
});
function render(pending = false, onRequestClose = vi.fn()) {
  return {
    onRequestClose,
    html: renderToStaticMarkup(
      <FormDialog
        open
        pending={pending}
        title="Yeni kayıt"
        description="Bilgileri girin"
        onRequestClose={onRequestClose}
        onSubmit={(event) => event.preventDefault()}
        footer={<button type="submit">Kaydet</button>}
      >
        <input name="name" />
      </FormDialog>,
    ),
  };
}
describe("FormDialog", () => {
  it("keeps the submit footer inside the form and scrolls only the body", () => {
    const { html } = render();
    expect(html).toContain("max-h-[90dvh]");
    expect(html).toContain("min-h-0 space-y-4 overflow-y-auto");
    expect(html).toContain("Yeni kayıt");
    expect(html).toContain("Bilgileri girin");
    expect(html.indexOf('<button type="submit"')).toBeLessThan(
      html.indexOf("</form>"),
    );
    expect(html).toContain('name="name"');
  });
  it.each([false, true])(
    "routes closing through the caller only while idle: pending=%s",
    (pending) => {
      const { onRequestClose, html } = render(pending);
      const preventDefault = vi.fn();
      state.root?.onOpenChange(false);
      state.content?.onEscapeKeyDown({ preventDefault });
      state.content?.onInteractOutside({ preventDefault });
      expect(onRequestClose).toHaveBeenCalledTimes(pending ? 0 : 1);
      expect(preventDefault).toHaveBeenCalledTimes(pending ? 2 : 0);
      expect(html).toContain(`aria-busy="${pending}"`);
    },
  );
  it("restores a connected explicit focus target", () => {
    const focus = vi.fn(),
      preventDefault = vi.fn();
    const target = { isConnected: true, focus } as unknown as HTMLElement;
    renderToStaticMarkup(
      <FormDialog
        open
        pending={false}
        title="Düzelt"
        onRequestClose={vi.fn()}
        onSubmit={vi.fn()}
        returnFocus={{ current: target }}
        footer={null}
      >
        Alan
      </FormDialog>,
    );
    state.content?.onCloseAutoFocus({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });
  it.each(["sm", "md", "lg"] as const)(
    "supports %s size without requiring a description",
    (size) => {
      const html = renderToStaticMarkup(
        <FormDialog
          open
          pending={false}
          size={size}
          title="Başlık"
          onRequestClose={vi.fn()}
          onSubmit={vi.fn()}
          footer={null}
        >
          Alan
        </FormDialog>,
      );
      expect(html).toContain(
        { sm: "sm:max-w-[440px]", md: "sm:max-w-lg", lg: "sm:max-w-2xl" }[size],
      );
      expect(html).not.toContain("Bilgileri girin");
    },
  );
});
