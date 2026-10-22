import type { MouseEvent } from "react";

/** Tıklanabilir satır: imleç satırın her yerinde (içindeki butonlar dahil) el işareti. */
export const ROW_CLICK_CLASS = "cursor-pointer [&_button]:cursor-pointer";

const INTERACTIVE = "button, a, input, select, textarea, label, [role='checkbox']";

/**
 * Satıra tıklama ayrıntıyı açsın mı? Satır içindeki buton/checkbox/link
 * tıklamaları, portal'daki menü öğeleri (React ağacında satıra kabarır ama
 * DOM'da satırın içinde değildir) ve metin seçimi hariç tutulur.
 */
export function isRowActivationClick(e: MouseEvent<HTMLElement>): boolean {
  const target = e.target;
  if (!(target instanceof Element) || !e.currentTarget.contains(target)) return false;
  if (target.closest(INTERACTIVE)) return false;
  return !window.getSelection()?.toString();
}

/** Satır `onClick`'i: yalnız satır aktivasyonunda `open`'ı çağırır. */
export function onRowActivate<T extends HTMLElement>(
  open: (e: MouseEvent<T>) => void,
) {
  return (e: MouseEvent<T>) => {
    if (isRowActivationClick(e)) open(e);
  };
}
