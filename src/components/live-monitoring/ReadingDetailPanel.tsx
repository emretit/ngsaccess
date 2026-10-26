import { usePermissions } from "@/hooks/usePermissions";
import { useCallback, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { AssignReadingCardForm } from "./AssignReadingCardForm";
import { personLabel, sourceLabel, resultLabel, trTime, physicalCard } from "./lib/readings";
export function Detail({ id, onDirty, onPending, onClose }: { onClose: () => void; id: Id<"cardReadings">; onDirty: (v: boolean) => void; onPending: (v: boolean) => void }) {
  const reading = useQuery(api.cardReadings.getReading, { readingId: id });
  const { projectId } = useActiveProjectScope();
  const { can } = usePermissions();
  const canManage = can("employees.manage");
  if (reading === undefined) return <SectionSkeleton rows={6} label="Okuma ayrıntısı yükleniyor" />;
  if (!reading || reading.projectId !== projectId) return <EmptyState title="Bu okuma artık görüntülenemiyor" description="Kayıt kaldırılmış olabilir veya bu projede erişiminiz olmayabilir." action={{ label: "Listeye dön", onClick: onClose }} />;
  const fields = [["Zaman (TR)", trTime(reading.accessTime)], ["Kişi", personLabel(reading)], ...(reading.source === "biometric" ? [] : [["Kart numarası", reading.cardNo]]), ["Kapı", reading.door?.name || "Kapı eşleşmedi"], ["Okuyucu", reading.door?.readerName || (reading.ideIoId !== undefined ? `IO ${reading.ideIoId}` : "Okuyucu bilinmiyor")], ["Cihaz", reading.devices?.name || "Cihaz bilinmiyor"], ["Yön", reading.direction === "entry" ? "Giriş" : reading.direction === "exit" ? "Çıkış" : "Bilinmiyor"], ["Departman", reading.employees?.departments?.name || "—"], ["Sonuç", resultLabel(reading)], ["Kaynak", sourceLabel(reading.source)]];
  return <div className="min-w-0 space-y-5"><dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 text-xs">{fields.map(([label, value]) => <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>
    {reading.accessStatus === "reddedildi" && <p className="text-xs [overflow-wrap:anywhere]">Ret sebebi: {reading.hikDenialReason || "Neden bilinmiyor"}</p>}
    <details className="text-xs"><summary className="cursor-pointer">Teknik ayrıntı</summary><p className="mt-2 break-all">Okuma: {reading._id} · Olay kodu: {reading.hikMajorEventType ?? "—"}/{reading.hikSubEventType ?? "—"}</p></details>
    {canManage && !reading.employeeId && reading.source === "card" && physicalCard(reading.cardNo) && <QuerySectionBoundary resetKey={reading._id} description="Kart atama formu yüklenemedi."><AssignReadingCardForm reading={reading} onDirty={onDirty} onPending={onPending} /></QuerySectionBoundary>}
  </div>;
}
export function ReadingDetailPanel({ readingId, onClose, trigger, onDirtyChange, onPendingChange }: { readingId: string; onClose: () => void; trigger: React.RefObject<HTMLElement | null>; onDirtyChange: (dirty: boolean) => void; onPendingChange: (pending: boolean) => void }) {
  const [dirty, setDirty] = useState(false);
  const pending = useRef(false);
  const guard = useUnsavedChangesGuard(dirty);
  const onDirty = useCallback((value: boolean) => { setDirty(value); onDirtyChange(value); }, [onDirtyChange]);
  const onPending = useCallback((value: boolean) => { pending.current = value; onPendingChange(value); }, [onPendingChange]);
  return <><Sheet open onOpenChange={open => { if (!open && !pending.current) guard.requestClose(onClose); }}><SheetContent size="full" className="flex w-full max-w-full flex-col p-4 sm:max-w-[480px] motion-reduce:animate-none motion-reduce:transition-none" onCloseAutoFocus={e => { if (trigger.current?.isConnected) { e.preventDefault(); trigger.current.focus(); } }}><SheetHeader className="shrink-0 pr-8 text-left"><SheetTitle>Okuma ayrıntısı</SheetTitle><SheetDescription>Erişim okuması · İstanbul saati</SheetDescription></SheetHeader><div className="min-w-0 flex-1 overflow-y-auto pt-5"><QuerySectionBoundary resetKey={readingId} description="Bu okuma artık görüntülenemiyor"><Detail id={readingId as Id<"cardReadings">} onDirty={onDirty} onPending={onPending} onClose={onClose} /></QuerySectionBoundary></div></SheetContent></Sheet>{guard.dialog}</>;
}
