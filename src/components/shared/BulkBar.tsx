import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children?: ReactNode }) {
  if (count <= 0) return null;
  return <div role="region" aria-label="Seçili kayıt işlemleri" className="flex flex-wrap items-center gap-3 border-b bg-selected px-3 py-2">
    <strong aria-live="polite" className="text-xs font-semibold tabular-nums text-primary">{count.toLocaleString("tr-TR")} kayıt seçili</strong>{children}<Button variant="ghost" size="sm" onClick={onClear} className="ml-auto">Seçimi kaldır</Button>
  </div>;
}
