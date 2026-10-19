import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PaginationBarProps {
  /** Sol taraftaki durum metni (role="status"). */
  summary: ReactNode;
  page: number;
  /** Toplam sayfa biliniyorsa "p / N", sunucu imleciyle sayfalanan listelerde yalnız "p". */
  pageCount?: number;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  /** Sonraki düğmesinin metni (ör. boş aday sayfada "Devam"). */
  nextLabel?: string;
  pageSize?: number;
  pageSizes?: readonly number[];
  onPageSizeChange?: (size: number) => void;
  /** Sayfa boyutu seçicisinin erişilebilir adı, ör. "Sayfadaki cihaz sayısı". */
  pageSizeLabel?: string;
  className?: string;
}

/** "a–b" aralığı; liste boşsa "0–0". */
export function pageRange(total: number, page: number, size: number): string {
  return `${total ? (page - 1) * size + 1 : 0}–${Math.min(page * size, total)}`;
}

/** Tüm listelerin ortak sayfalama çubuğu (Cihazlar listesindeki görünüm). */
export function PaginationBar({
  summary,
  page,
  pageCount,
  onPrevious,
  onNext,
  previousDisabled = page <= 1,
  nextDisabled = pageCount !== undefined && page >= pageCount,
  nextLabel = "Sonraki",
  pageSize,
  pageSizes,
  onPageSizeChange,
  pageSizeLabel = "Sayfadaki kayıt sayısı",
  className,
}: PaginationBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2 text-xs text-muted-foreground", className)}>
      <span role="status">{summary}</span>
      <div className="flex flex-wrap items-center gap-2">
        {pageSize !== undefined && pageSizes && onPageSizeChange && (
          <Select value={String(pageSize)} onValueChange={value => onPageSizeChange(Number(value))}>
            <SelectTrigger aria-label={pageSizeLabel} className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{pageSizes.map(size => <SelectItem key={size} value={String(size)}>{size} / sayfa</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" disabled={previousDisabled} onClick={onPrevious}>Önceki</Button>
        <span className="tabular-nums">{pageCount === undefined ? page : `${page} / ${pageCount}`}</span>
        <Button variant="outline" size="sm" disabled={nextDisabled} onClick={onNext}>{nextLabel}</Button>
      </div>
    </div>
  );
}
