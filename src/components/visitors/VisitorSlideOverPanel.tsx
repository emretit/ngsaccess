import { useCallback, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Visitor, VisitorDetail } from "@/types/visitor";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/shared/RowActions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { notify } from "@/lib/notify";
import { visitorPresenceLabels, visitorStatusInfo } from "./lib/status";
import { formatVisitorTime } from "./visitorTime";
import VisitorForm from "./VisitorForm";
import { useStableQuery } from "./hooks/useStableQuery";

export default function VisitorSlideOverPanel({ isOpen, onClose, visitor, onSave, refreshKey, canManage }: {
  isOpen: boolean; onClose: () => void; visitor: Visitor | null; onSave: (payload?: unknown) => void; refreshKey: number; canManage: boolean;
}) {
  const [formState, setFormState] = useState({ dirty: false, pending: false });
  const guard = useUnsavedChangesGuard(formState.dirty);
  const close = () => { if (!formState.pending) guard.requestClose(onClose); };
  const onFormState = useCallback((dirty: boolean, pending: boolean) => setFormState({ dirty, pending }), []);
  return <><Sheet open={isOpen} onOpenChange={open => { if (!open) close(); }}>
    <SheetContent size="md" className="flex h-dvh max-w-full [overflow-wrap:anywhere] flex-col gap-0 p-0 sm:max-w-[520px] md:max-w-[520px]">
      <SheetHeader className="shrink-0 border-b p-5 pr-14 text-left"><SheetTitle>{visitor ? `${visitor.firstName} ${visitor.lastName}` : "Ziyaretçi kaydet"}</SheetTitle><SheetDescription>Seçili projenin geçici erişim kaydı</SheetDescription></SheetHeader>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <QuerySectionBoundary title={visitor ? "Ziyaret ayrıntısı yüklenemedi" : "Form bilgileri yüklenemedi"} resetKey={visitor?._id ?? "new"}>
          {visitor ? <VisitorDetailContent visitor={visitor} refreshKey={refreshKey} canManage={canManage} onClose={close} onSaved={onClose} onFormState={onFormState} /> :
            <VisitorForm onClose={close} onSave={onSave} onStateChange={onFormState} />}
        </QuerySectionBoundary>
      </div>
    </SheetContent>
  </Sheet>{guard.dialog}</>;
}

function VisitorDetailContent({ visitor, refreshKey, canManage, onClose, onSaved, onFormState }: {
  visitor: Visitor; refreshKey: number; canManage: boolean; onClose: () => void; onSaved: () => void; onFormState: (dirty: boolean, pending: boolean) => void;
}) {
  const detail = useStableQuery(useQuery(api.visitors.getDetail, { visitorId: visitor._id, refreshKey }), visitor._id);
  const [editing, setEditing] = useState(false);
  if (detail === undefined) return <SectionSkeleton className="p-5" rows={6} label="Ziyaret ayrıntısı yükleniyor" />;
  if (!detail) return <EmptyState title="Ziyaretçi bulunamadı" description="Kayıt silinmiş veya artık bu projede bulunmuyor olabilir." />;
  if (editing) return <VisitorForm visitor={detail} onClose={onClose} onSave={onSaved} onStateChange={onFormState} />;
  return <VisitorDetailView detail={detail} canManage={canManage} onEdit={() => setEditing(true)} onDeleted={onSaved} />;
}

function VisitorDetailView({ detail, canManage, onEdit, onDeleted }: { detail: VisitorDetail; canManage: boolean; onEdit: () => void; onDeleted: () => void }) {
  const [showCard, setShowCard] = useState(false);
  const [confirmation, setConfirmation] = useState<"checkout" | "release" | "delete" | null>(null);
  const checkOut = useMutation(api.visitors.checkOut);
  const releaseCard = useMutation(api.visitors.releaseCard);
  const remove = useMutation(api.employees.remove);
  const status = visitorStatusInfo[detail.status];
  const name = `${detail.firstName} ${detail.lastName}`;
  const fields = [
    ["Geçerlilik bitişi (TR)", formatVisitorTime(detail.visitEnd)],
    ["Erişim bölgesi", detail.presetRuleName ?? "Kaydedilmedi"],
    ["Ziyaret edilen", detail.hostName ?? "Seçilmedi"],
    ["Son okumaya göre konum", visitorPresenceLabels[detail.presence]],
    ["Son izinli okuma", formatVisitorTime(detail.lastSeenAt)],
  ];
  return <div className="min-w-0 space-y-5 p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge tone={status.tone}>{status.label}</StatusBadge>{canManage && <Button variant="outline" onClick={onEdit}>Düzenle</Button>}</div>
    <dl className="space-y-4">{fields.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words tabular-nums">{value}</dd></div>)}
      <div><dt className="text-xs text-muted-foreground">Kart</dt><dd className="break-all tabular-nums">{detail.cardReleased ? "İade edildi" : showCard ? detail.cardNumber : `•••• ${detail.cardNumber.slice(-4)}`}
        {!detail.cardReleased && <Button variant="ghost" size="sm" onClick={() => setShowCard(previous => !previous)}>{showCard ? "Gizle" : "Tam numarayı göster"}</Button>}</dd></div>
    </dl>
    <p className="text-xs text-muted-foreground">Son konum izinli okumaya dayanır. Sürenin dolması veya manuel sonlandırma fiziksel çıkış okuması oluşturmaz.</p>
    <details className="space-y-3 border-t pt-3"><summary className="cursor-pointer font-medium">Şirket, iletişim ve ek bilgiler</summary><dl className="space-y-3">
      {[["Şirket", detail.visitorCompany], ["Ziyaret amacı", detail.visitPurpose], ["Telefon", detail.visitorPhone], ["E-posta", detail.email], ["Notlar", detail.notes]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words">{value || "Kaydedilmedi"}</dd></div>)}
    </dl></details>
    <div className="space-y-1 border-t pt-3"><h3 className="font-medium">KVKK rıza kaydı</h3><p>{detail.kvkkConsent ? `Kayıt tarihi: ${formatVisitorTime(detail.kvkkConsent.grantedAt)}` : "Rıza kaydı bulunmuyor."}</p>
      {detail.kvkkConsent && <><p className="text-xs text-muted-foreground">Sürüm: {detail.kvkkConsent.version ?? "Kaydedilmedi"}</p>{detail.kvkkConsent.documentUrl && /^https?:\/\//i.test(detail.kvkkConsent.documentUrl) && <a className="underline" href={detail.kvkkConsent.documentUrl} target="_blank" rel="noopener noreferrer">Kayıtlı belgeyi aç</a>}</>}
    </div>
    <div className="space-y-2 border-t pt-3"><h3 className="font-medium">Son okumalar</h3>{detail.recentReadings.length ? <ul className="divide-y">{detail.recentReadings.map(reading => <li key={reading._id} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><time className="tabular-nums">{formatVisitorTime(reading.accessTime)}</time><span>{reading.direction === "entry" ? "Giriş" : reading.direction === "exit" ? "Çıkış" : "Yön bilinmiyor"} · {reading.accessStatus === "izin_verildi" ? "İzin verildi" : reading.accessStatus === "reddedildi" ? "Reddedildi" : "Sonuç bilinmiyor"}</span></li>)}</ul> : <p className="text-muted-foreground">Henüz kart okuması yok.</p>}</div>
    {canManage && <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-surface py-3">
      {detail.isActive && <Button variant="outline" onClick={() => setConfirmation("checkout")}>Ziyareti sonlandır</Button>}
      <RowActions label={`${name} kayıt işlemleri`}>
        {!detail.isActive && !detail.cardReleased && <DropdownMenuItem onSelect={() => setConfirmation("release")}>Kartı serbest bırak</DropdownMenuItem>}
        <DropdownMenuItem className="text-destructive" onSelect={() => setConfirmation("delete")}>Ziyaretçi kaydını sil</DropdownMenuItem>
      </RowActions>
    </div>}
    <ConfirmDestructive open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null); }} objectName={name}
      title={confirmation === "delete" ? "Ziyaretçi kaydı silinsin mi?" : confirmation === "release" ? "Kart serbest bırakılsın mı?" : "Ziyaret sonlandırılsın mı?"}
      confirmLabel={confirmation === "delete" ? "Kaydı sil" : confirmation === "release" ? "Kartı serbest bırak" : "Ziyareti sonlandır"}
      effects={confirmation === "delete" ? ["Ziyaretçi kaydı ve bölge üyelikleri kalıcı olarak silinir.", "Cihazlardan kaldırma işlemi başlatılır; bağlı kişisel veriler temizlenir."] : confirmation === "release" ? ["Fiziksel kartı teslim aldığınızı doğrulayın. Kart numarası başka ziyaretçiye verilebilir."] : ["Erişim pasife alınır; cihazlardan kaldırma işlemi başlatılır.", "Fiziksel çıkış okuması oluşmaz; kart iadesi ayrıdır."]}
      onConfirm={async () => {
        if (confirmation === "delete") { await remove({ employeeId: detail._id }); notify.success("Ziyaretçi kaydı silindi"); onDeleted(); }
        else if (confirmation === "release") { await releaseCard({ visitorId: detail._id }); notify.success("Kart serbest bırakıldı"); }
        else if (confirmation === "checkout") { await checkOut({ visitorId: detail._id }); notify.success("Ziyaret sonlandırıldı", "Cihaz işlemleri arka planda yürütülüyor."); }
      }} />
  </div>;
}
