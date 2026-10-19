import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Panel satırı: mobilde 44 px dokunma alanı, masaüstünde sıkı. */
export const TREE_ROW_HEIGHT = "min-h-11 min-[1100px]:min-h-7";
/** Kaydırılabilir panelde dış odak halkası kırpılır; halka içe çizilir. */
export const INSET_FOCUS = "focus-visible:outline-offset-[-2px]";
export const TREE_ICON_BUTTON = "h-11 w-11 shrink-0 min-[1100px]:h-7 min-[1100px]:w-7";
/** Ağaç satırının seçim düğmesi (ad). */
export const TREE_NAME_BUTTON = cn("min-w-0 flex-1 truncate pr-1 text-left text-sm", TREE_ROW_HEIGHT, INSET_FOCUS);
/** Alt öğeleri açıp kapatan ok; yeri her satırda ayrılır (w-5), adlar hizalı kalır. */
export const TREE_TOGGLE_BUTTON = cn("grid w-5 shrink-0 place-items-center rounded-sm text-muted-foreground hover:text-foreground", TREE_ROW_HEIGHT, INSET_FOCUS);
/** Satırın "…" menüsü: masaüstünde yalnız satır üzerindeyken, odaktayken veya açıkken görünür; dokunmatik ekranlarda hep görünür. Satır kapsayıcısında `group` olmalı. */
export const TREE_ROW_ACTIONS =
  "shrink-0 [&_button]:h-11 [&_button]:w-11 min-[1100px]:opacity-0 min-[1100px]:group-hover:opacity-100 min-[1100px]:focus-within:opacity-100 min-[1100px]:has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100! min-[1100px]:[&_button]:h-7 min-[1100px]:[&_button]:w-7";
/** Ağacın üstündeki sabit filtre satırı ("Tüm personel", "Atanmamış" …). */
export const treeFixedItemClass = cn(
  "flex w-full min-w-0 items-center rounded-sm pr-1.5 text-left text-sm hover:bg-muted aria-pressed:bg-selected aria-pressed:font-medium aria-pressed:text-primary",
  TREE_ROW_HEIGHT,
  INSET_FOCUS,
);

/** Tablo başlığıyla aynı görünüm: gri şerit, küçük etiket, sağda düğmeler. */
export function TreePanelHeader({
  title,
  onAddClick,
  addLabel,
  children,
}: {
  title: string;
  onAddClick?: () => void;
  addLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 min-w-0 items-center justify-between border-b bg-subtle pl-2 pr-0.5 min-[1100px]:min-h-9">
      <h2 className="truncate text-[11px] font-medium text-muted-foreground">{title}</h2>
      <div className="flex shrink-0 items-center">
        {children}
        {onAddClick && (
          <Button variant="ghost" size="icon" className={TREE_ICON_BUTTON} aria-label={addLabel} onClick={onAddClick}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Liste sayfalarının sol filtre paneli: masaüstünde sabit kart, mobilde açılır düğme. */
export function TreePanel({
  id,
  label,
  summary,
  header,
  footer,
  children,
}: {
  id: string;
  /** Erişilebilir ad ve mobil düğmenin ön eki, ör. "Departmanlar". */
  label: string;
  /** Mobil düğmede seçili öğe, ör. "Tüm personel". */
  summary: string;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="w-full min-w-0 shrink-0 min-[1100px]:w-[220px]">
      <button
        type="button"
        className="block min-h-11 w-full min-w-0 truncate rounded-md border bg-surface px-3 text-left text-sm min-[1100px]:hidden"
        aria-expanded={mobileOpen}
        aria-controls={id}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {label} · {summary}
      </button>
      <nav
        id={id}
        aria-label={label}
        className={cn(
          "mt-2 overflow-hidden rounded-md border bg-surface min-[1100px]:mt-0",
          mobileOpen ? "block" : "hidden min-[1100px]:block",
        )}
      >
        {header}
        <div className="max-h-[calc(100vh-14rem)] space-y-1 overflow-y-auto p-1">{children}</div>
        {footer && (
          <p className="border-t px-2 py-1.5 text-[11px] leading-4 text-muted-foreground">{footer}</p>
        )}
      </nav>
    </div>
  );
}
