import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DetailSheet } from "./DetailSheet";
import type { SheetContent } from "@/components/ui/sheet";

const captured = vi.hoisted(() => ({
  content: {} as ComponentProps<typeof SheetContent>,
  change: undefined as undefined | ((open: boolean) => void),
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, onOpenChange }: { children: ReactNode; onOpenChange: (open: boolean) => void }) => {
    captured.change = onOpenChange;
    return children;
  },
  SheetContent: (props: ComponentProps<typeof SheetContent>) => {
    captured.content = props;
    return <section className={props.className} aria-describedby={props["aria-describedby"]}>{props.children}</section>;
  },
  SheetHeader: ({ children, className }: { children: ReactNode; className: string }) => <header className={className}>{children}</header>,
  SheetTitle: ({ children, tabIndex }: { children: ReactNode; tabIndex?: number }) => <h2 tabIndex={tabIndex}>{children}</h2>,
  SheetDescription: ({ children, id }: { children: ReactNode; id?: string }) => <p id={id}>{children}</p>,
}));
const base = { open: true, onRequestClose: vi.fn(), title: "Ayrıntı", description: "Bağlam", children: <input defaultValue="taslak" /> };
beforeEach(() => vi.clearAllMocks());

describe("DetailSheet", () => {
  it("keeps named widths, header slots, description binding and a footer outside body scrolling", () => {
    const html = renderToStaticMarkup(<DetailSheet {...base} size="lg" descriptionId="context" headerExtra={<span>Durum</span>} footer={<button>Kaydet</button>} />);
    expect(html).toContain("sm:w-[700px] sm:max-w-[700px] md:max-w-[700px]");
    expect(html).toContain("px-5 py-3");
    expect(html).toContain('aria-describedby="context"');
    expect(html).toContain('<h2>Ayrıntı</h2><span>Durum</span><p id="context">Bağlam</p>');
    expect(html).toContain('value="taslak"/></div><button>Kaydet</button>');
    expect(captured.content.forceMount).toBeUndefined();
  });
  it.each([false, true])("blocks all dismiss paths only while pending=%s", pending => {
    renderToStaticMarkup(<DetailSheet {...base} pending={pending} />);
    const escape = new Event("escape", { cancelable: true });
    captured.content.onEscapeKeyDown?.(escape as KeyboardEvent);
    const outside = new CustomEvent("outside", { cancelable: true, detail: { originalEvent: new Event("pointerdown") as PointerEvent } });
    captured.content.onInteractOutside?.(outside);
    captured.change?.(false);
    expect(escape.defaultPrevented).toBe(pending);
    expect(outside.defaultPrevented).toBe(pending);
    expect(base.onRequestClose).toHaveBeenCalledTimes(pending ? 0 : 1);
    captured.change?.(true);
    expect(base.onRequestClose).toHaveBeenCalledTimes(pending ? 0 : 1);
  });
  it("restores the supplied focus and leaves default focus intact without a target ref", () => {
    const focus = vi.fn();
    renderToStaticMarkup(<DetailSheet {...base} returnFocus={{ current: { focus } as unknown as HTMLElement }} />);
    const event = new Event("close", { cancelable: true });
    captured.content.onCloseAutoFocus?.(event);
    expect(event.defaultPrevented).toBe(true);
    expect(focus).toHaveBeenCalledOnce();
    renderToStaticMarkup(<DetailSheet {...base} />);
    const natural = new Event("close", { cancelable: true });
    captured.content.onCloseAutoFocus?.(natural);
    expect(natural.defaultPrevented).toBe(false);
  });
  it("supports title autofocus for editing while keeping creation autofocus unchanged", () => {
    const html = renderToStaticMarkup(<DetailSheet {...base} focusTitleOnOpen />);
    expect(html).toContain('tabindex="-1"');
    const edit = new Event("open", { cancelable: true });
    captured.content.onOpenAutoFocus?.(edit);
    expect(edit.defaultPrevented).toBe(true);
    renderToStaticMarkup(<DetailSheet {...base} />);
    const create = new Event("open", { cancelable: true });
    captured.content.onOpenAutoFocus?.(create);
    expect(create.defaultPrevented).toBe(false);
  });
  it("keeps whole-sheet scrolling and responsive size overrides for existing drawers", () => {
    const html = renderToStaticMarkup(<DetailSheet {...base} size="wide" scroll="all" />);
    expect(html).toContain("sm:max-w-[720px] overflow-y-auto");
    expect(html).not.toContain("min-h-0");
    const narrow = renderToStaticMarkup(<DetailSheet {...base} contentProps={{ className: "sm:max-w-[520px] md:max-w-[520px]" }} />);
    expect(narrow).toContain("sm:max-w-[520px] md:max-w-[520px]");
    expect(narrow).not.toContain("sm:max-w-md");
  });
});
