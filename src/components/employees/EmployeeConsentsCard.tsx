import { Link } from "react-router-dom";
import { useConsentDocumentUpload } from "./hooks/useConsentDocumentUpload";
import { Input } from "@/components/ui/input";
import type { Doc } from "../../../convex/_generated/dataModel";
import { BIOMETRIC_NOTICE_TEMPLATE } from "@/lib/consentNotice";
import { useId, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { formatTrDateTime } from "@/lib/date";
import { ShieldCheck, ShieldX, ScanFace, Fingerprint, CreditCard, Camera } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useAuth } from "@/components/auth/AuthProvider";
import { capabilities } from "@/lib/capabilities";
import { notify } from "@/lib/notify";

type ConsentType = "biometric_face" | "biometric_fingerprint" | "card" | "photo";

const CONSENT_META: Record<
  ConsentType,
  { label: string; description: string; icon: typeof ScanFace }
> = {
  biometric_face: {
    label: "Yüz tanıma",
    description: "Yalnız kapı erişimi; mesai takibinde kullanılmaz",
    icon: ScanFace,
  },
  biometric_fingerprint: {
    label: "Parmak izi",
    description: "Yalnız kapı erişimi; mesai takibinde kullanılmaz",
    icon: Fingerprint,
  },
  card: {
    label: "Kart verisi",
    description: "Genel veri — sözleşme zemini",
    icon: CreditCard,
  },
  photo: {
    label: "Fotoğraf",
    description: "Profil fotoğrafı; isteğe bağlı",
    icon: Camera,
  },
};

interface PDKSEmployeeConsentsCardProps {
  employeeId: Id<"employees">;
}

export function EmployeeConsentsCard({ employeeId }: PDKSEmployeeConsentsCardProps) {
  const { profile } = useAuth();
  const canManageConsents = capabilities(profile?.role).admin;
  const consents = useQuery(api.employeeConsents.listForEmployee, { employeeId });
  const biometricModule = useQuery(api.privacyBiometric.getEmployeeBiometricModule, { employeeId });
  const fingerprints = useQuery(api.fingerprintEnrollment.listForEmployee, canManageConsents ? { employeeId } : "skip");
  const notesId = useId();
  const [revokeTarget, setRevokeTarget] = useState<{ id: Id<"employeeConsents">; label: string; type: ConsentType } | null>(null);
  const grant = useMutation(api.employeeConsents.grant);
  const revoke = useMutation(api.employeeConsents.revoke);

  const [grantingType, setGrantingType] = useState<Exclude<ConsentType, "card"> | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const convex = useConvex();
  const document = useConsentDocumentUpload();
  const documentInputId = useId();
  const activeByType = new Map<ConsentType, Doc<"employeeConsents">>();
  for (const c of consents ?? []) {
    if (!c.revokedAt) {
      if (c.consentType !== "visitor_kvkk") activeByType.set(c.consentType, c);
    }
  }

  const handleGrant = async () => {
    if (!canManageConsents || document.pending || document.error || !grantingType || (grantingType.startsWith("biometric_") && biometricModule?.enabled !== true)) return;
    setSubmitting(true);
    try {
      await grant({
        employeeId,
        consentType: grantingType,
        documentStorageId: document.storageId,
        notes: notes.trim() || undefined,
      });
      notify.success("Rıza alındı", CONSENT_META[grantingType].label);
      document.reset();
      setGrantingType(null);
      setNotes("");
    } catch (e) {
      notify.error("Rıza alınamadı", e);
    } finally {
      setSubmitting(false);
    }
  };

  if (consents === undefined) {
    return (
      <section className="space-y-3 border-t pt-5">
        <h3 className="text-base font-semibold">KVKK rızaları</h3>
        <SectionSkeleton rows={2} label="Rızalar yükleniyor" />
      </section>
    );
  }

  return (
    <section className="space-y-3 border-t pt-5">
      <h3 className="text-base font-semibold">KVKK rızaları</h3>
      <p className="text-xs text-muted-foreground">
        Biyometri yalnız erişim kontrolü içindir; rıza yoksa kayıt eklenemez.
      </p>
      <details className="text-xs">
        <summary className="cursor-pointer font-medium">Aydınlatma metni şablonu</summary>
        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-muted-foreground">{BIOMETRIC_NOTICE_TEMPLATE}</pre>
        <Button type="button" variant="outline" size="sm" className="max-sm:min-h-11 mt-3" onClick={async () => {
          try { await navigator.clipboard.writeText(BIOMETRIC_NOTICE_TEMPLATE); notify.success("Şablon kopyalandı"); }
          catch (error: unknown) { notify.error("Şablon kopyalanamadı", error); }
        }}>Şablonu kopyala</Button>
      </details>
      <Separator />
      <div className="space-y-2">
        {(Object.keys(CONSENT_META) as ConsentType[]).filter(type => type !== "card" || activeByType.has("card")).map((type) => {
          const meta = CONSENT_META[type];
          const Icon = meta.icon;
          const active = activeByType.get(type);
          const moduleClosed = type.startsWith("biometric_") && biometricModule?.enabled === false;
          return (
            <div
              key={type}
              className="flex items-start gap-3 rounded-md border border-border p-3"
            >
              <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{meta.label}</span>
                  {active ? (
                    <Badge variant="successSubtle" className="text-xs">
                      Aktif
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {moduleClosed ? "Kapalı" : type === "photo" ? "İsteğe bağlı" : "Rıza yok"}
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {meta.description}
                </div>
                {!active && moduleClosed && <p className="text-xs text-muted-foreground mt-1">
                  Biyometri modülü kapalı. {canManageConsents && <Link className="underline" to="/settings?tab=privacy">Ayarlar › Gizlilik ve KVKK</Link>}
                </p>}
                {active && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Alındı: {formatTrDateTime(new Date(active.grantedAt))}
                    {active.notes && <span> · {active.notes}</span>}
                  </div>
                )}
                {canManageConsents && active?.documentStorageId && <Button type="button" variant="link" size="sm" className="max-sm:min-h-11 px-0" onClick={async () => {
                  let tab: Window | null = null;
                  try {
                    tab = window.open("", "_blank");
                    if (!tab) throw new Error("Belge sekmesi açılamadı.");
                    tab.opener = null;
                    const url = await convex.query(api.employeeConsents.getDocumentUrl, { id: active._id });
                    if (!url) throw new Error("Belge bulunamadı.");
                    tab.location.href = url;
                  } catch (error: unknown) { tab?.close(); notify.error("Belge açılamadı", error); }
                }}>Belgeyi aç</Button>}
              </div>
              {canManageConsents && <div className="shrink-0">
                {active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`${meta.label} rızasını iptal et`}
                    onClick={() => setRevokeTarget({ id: active._id, label: meta.label, type })}
                    className="max-sm:min-h-11 gap-1.5"
                  >
                    <ShieldX className="h-3.5 w-3.5" />
                    İptal
                  </Button>
                ) : !moduleClosed && type !== "card" ? (
                  <Button
                    size="sm"
                    aria-label={`${meta.label} rızası al`}
                    disabled={type.startsWith("biometric_") && biometricModule?.enabled !== true}
                    onClick={() => { document.reset(); setGrantingType(type); }}
                    className="max-sm:min-h-11 gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Rıza al
                  </Button>
                ) : null}
              </div>}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">Kart verisi iş sözleşmesine dayanır; ayrıca rıza gerekmez.</p>
      {canManageConsents && (
        <>
          <Dialog
            open={grantingType !== null}
            onOpenChange={(open) => {
              if (!open && !submitting) {
                document.reset();
                setGrantingType(null);
                setNotes("");
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {grantingType ? CONSENT_META[grantingType].label : ""} rızası
                </DialogTitle>
                <DialogDescription>
                  Bu işlem çalışanın ayrı alınmış açık rıza beyanını kaydeder. Biyometri yalnız erişim kontrolü içindir.
                  Çalışan istediği zaman geri alabilir.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <label htmlFor={notesId} className="text-xs font-medium">Not (isteğe bağlı)</label>
                <Textarea id={notesId}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Örn: Çalışan imzalı form arşivde, ref #1234"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor={documentInputId} className="text-xs font-medium">İmzalı rıza formu (önerilir)</label>
                <Input id={documentInputId} type="file" accept="application/pdf,image/jpeg,image/png" disabled={document.pending || submitting} className="max-sm:min-h-11" onChange={event => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void document.upload(file);
                }} />
                <p className="text-xs text-muted-foreground">PDF, JPEG veya PNG; en çok 10 MB.</p>
                {document.pending && <p role="status" className="text-xs">Belge yükleniyor…</p>}
                {document.error && <p role="alert" className="text-xs">{document.error}</p>}
                {document.storageId && <p role="status" className="text-xs">Belge yüklendi.</p>}
                {(document.storageId || document.error) && <Button type="button" variant="outline" size="sm" className="max-sm:min-h-11" disabled={document.pending || submitting} onClick={document.reset}>Belgeyi kaldır</Button>}
              </div>
              <DialogFooter>
                <Button className="max-sm:min-h-11"
                  variant="outline"
                  onClick={() => {
                    document.reset();
                    setGrantingType(null);
                    setNotes("");
                  }}
                  disabled={submitting}
                >
                  İptal
                </Button>
                <Button className="max-sm:min-h-11" onClick={handleGrant} disabled={submitting || document.pending || Boolean(document.error) || (grantingType?.startsWith("biometric_") === true && biometricModule?.enabled !== true)}>
                  {submitting ? "Kaydediliyor..." : "Rızayı kaydet"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ConfirmDestructive open={revokeTarget !== null} onOpenChange={open => { if (!open) setRevokeTarget(null); }}
            title="Rıza iptal edilsin mi?" objectName={revokeTarget?.label ?? "Rıza"}
            effects={[revokeTarget?.type === "biometric_fingerprint" ? fingerprints && fingerprints.enrollments.length > 0 ? `Cihazlardaki ${fingerprints.enrollments.length} parmak izi kaydı da silinir.` : "Cihazlardaki parmak izi kayıtları da silinir." : "Rıza kaydı geri alınmış olarak işaretlenir; geçmiş korunur."]}
            confirmLabel="Rızayı iptal et" onConfirm={async () => {
              if (!canManageConsents || !revokeTarget) return;
              await revoke({ id: revokeTarget.id });
              notify.success("Rıza iptal edildi", revokeTarget.label);
            }} />
        </>
      )}
    </section>
  );
}
