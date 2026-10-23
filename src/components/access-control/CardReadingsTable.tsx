import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { onRowActivate, ROW_CLICK_CLASS } from "@/lib/tableRowClick";
import { sourceLabel, resultLabel, personLabel, trTime, type Reading } from "@/components/live-monitoring/lib/readings";

export function CardReadingsTable({ readings, onOpen, freshIds, emptyMessage = "Henüz erişim okuması yok. İlk okuma geldiğinde burada görünecek." }: { readings: Reading[]; onOpen: (reading: Reading, trigger: HTMLElement) => void; emptyMessage?: string; freshIds?: ReadonlySet<string> }) {
  const result = (r: Reading) => <><StatusBadge tone={r.accessStatus === "izin_verildi" ? "success" : r.accessStatus === "reddedildi" ? "danger" : "neutral"}>{resultLabel(r)}</StatusBadge>{r.accessStatus === "reddedildi" && <span className="block max-w-64 truncate text-xs text-muted-foreground" title={r.hikDenialReason}>{r.hikDenialReason || "Neden bilinmiyor"}</span>}</>;
  const openRow = (r: Reading) => onRowActivate<HTMLElement>(e => onOpen(r, e.currentTarget.querySelector("button") ?? e.currentTarget));
  const action = (r: Reading) => <Button variant="ghost" aria-label={`${trTime(r.accessTime)} ${personLabel(r)} okuma ayrıntısı`} onClick={e => onOpen(r, e.currentTarget)}>Ayrıntı</Button>;
  if (!readings.length) return <EmptyState title="Okuma bulunamadı" description={emptyMessage} />;
  return <>
    <div className="hidden min-w-0 overflow-x-auto rounded-md border border-line min-[761px]:block"><Table density="compact"><TableHeader><TableRow>{["Zaman (TR)", "Kişi / kart", "Kapı / cihaz", "Yön", "Sonuç", "Kaynak", "İşlem"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{readings.map(r => <TableRow key={r._id} className={`${ROW_CLICK_CLASS} ${freshIds?.has(r._id) ? "bg-info-bg" : ""}`} onClick={openRow(r)}>
      <TableCell className="whitespace-nowrap tabular-nums text-xs">{freshIds?.has(r._id) && <span className="mr-1">Yeni</span>}{trTime(r.accessTime)}</TableCell>
      <TableCell><span className="block max-w-48 truncate" title={personLabel(r)}>{personLabel(r)}</span><span className="block max-w-48 truncate text-xs text-muted-foreground tabular-nums" title={r.cardNo}>{r.cardNo}</span></TableCell>
      <TableCell><span className="block max-w-44 truncate">{r.door?.name || "Kapı eşleşmedi"}</span><span className="block max-w-44 truncate text-xs text-muted-foreground">{r.devices?.name || (r.deviceId ? "Silinmiş cihaz" : "Cihaz bilinmiyor")}</span></TableCell>
      <TableCell>{r.direction === "entry" ? "Giriş" : r.direction === "exit" ? "Çıkış" : "Bilinmiyor"}</TableCell><TableCell>{result(r)}</TableCell><TableCell><span className="rounded border border-line px-1.5 py-0.5 text-xs">{sourceLabel(r.source)}</span></TableCell><TableCell>{action(r)}</TableCell>
    </TableRow>)}</TableBody></Table></div>
    <div className="min-w-0 divide-y divide-line border-y border-line min-[761px]:hidden">{readings.map(r => <article key={r._id} className={`min-w-0 py-3 ${ROW_CLICK_CLASS} ${freshIds?.has(r._id) ? "bg-info-bg" : ""}`} onClick={openRow(r)}><div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs tabular-nums text-muted-foreground">{freshIds?.has(r._id) ? "Yeni · " : ""}{trTime(r.accessTime)}</p><p className="break-words font-medium">{personLabel(r)}</p><p className="break-all text-xs tabular-nums">{r.cardNo}</p><p className="break-words text-xs">{r.door?.name || "Kapı eşleşmedi"}</p></div>{action(r)}</div><div className="mt-2 flex flex-wrap items-center gap-2 text-xs">{result(r)}<span>{sourceLabel(r.source)}</span></div></article>)}</div>
  </>;
}
