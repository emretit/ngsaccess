import { BIOMETRIC_NOTICE_TEMPLATE } from "@/lib/consentNotice";
import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
  { label: string; description: string; icon: typeof ScanFace; required: boolean }
> = {
  biometric_face: {
    label: "Yüz Tanıma",
    description: "Yalnız erişim kontrolü — ayrı açık rıza kaydı",
    icon: ScanFace,
    required: true,
  },
  biometric_fingerprint: {
    label: "Parmak İzi",
    description: "Yalnız erişim kontrolü — ayrı açık rıza kaydı",
    icon: Fingerprint,
    required: true,
  },
  card: {
    label: "Kart Verisi",
    description: "Genel veri — sözleşme zemini",
    icon: CreditCard,
    required: false,
  },
  photo: {
    label: "Fotoğraf",
    description: "Kişisel veri — açık rıza önerilir",
    icon: Camera,
    required: false,
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
  const notesId = useId();
  const [revokeTarget, setRevokeTarget] = useState<{ id: Id<"employeeConsents">; label: string } | null>(null);
  const grant = useMutation(api.employeeConsents.grant);
  const revoke = useMutation(api.employeeConsents.revoke);

  const [grantingType, setGrantingType] = useState<ConsentType | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeByType = new Map<ConsentType, { id: Id<"employeeConsents">; grantedAt: string; notes?: string }>();
  for (const c of consents ?? []) {
    if (!c.revokedAt) {
      activeByType.set(c.consentType as ConsentType, {
        id: c._id,
        grantedAt: c.grantedAt,
        notes: c.notes,
      });
    }
  }

  const handleGrant = async () => {
    if (!canManageConsents || !grantingType || (grantingType.startsWith("biometric_") && biometricModule?.enabled !== true)) return;
    setSubmitting(true);
    try {
      await grant({
        employeeId,
        consentType: grantingType,
        notes: notes.trim() || undefined,
      });
      notify.success("Rıza alındı", CONSENT_META[grantingType].label);
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
        Biyometri yalnız erişim kontrolü için değerlendirilir. Rıza yoksa yüz/parmak izi kaydı eklenemez. Yasal danışmanınıza doğrulatın.
      </p>
      <details className="text-xs">
        <summary className="cursor-pointer font-medium">Aydınlatma metni şablonu</summary>
        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-muted-foreground">{BIOMETRIC_NOTICE_TEMPLATE}</pre>
        <Button type="button" variant="outline" size="sm" className="max-sm:min-h-11 mt-3" onClick={async () => {
          try { await navigator.clipboard.writeText(BIOMETRIC_NOTICE_TEMPLATE); notify.success("Şablon kopyalandı"); }
          catch (error: unknown) { notify.error("Şablon kopyalanamadı", error); }
        }}>Şablonu kopyala</Button>
      </details>
      {biometricModule?.enabled === false && <p className="text-xs text-muted-foreground">Biyometri modülü kapalı; yüz ve parmak izi rızası eklenemez. Mevcut rızalar iptal edilebilir.</p>}
      <Separator />
      <div className="space-y-2">
        {(Object.keys(CONSENT_META) as ConsentType[]).map((type) => {
          const meta = CONSENT_META[type];
          const Icon = meta.icon;
          const active = activeByType.get(type);
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
                  ) : meta.required ? (
                    <Badge variant="destructive" className="text-xs">
                      Rıza Yok
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Yok
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {meta.description}
                </div>
                {active && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Alındı: {formatTrDateTime(new Date(active.grantedAt))}
                    {active.notes && <span> · {active.notes}</span>}
                  </div>
                )}
              </div>
              {canManageConsents && <div className="shrink-0">
                {active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`${meta.label} rızasını iptal et`}
                    onClick={() => setRevokeTarget({ id: active.id, label: meta.label })}
                    className="max-sm:min-h-11 gap-1.5"
                  >
                    <ShieldX className="h-3.5 w-3.5" />
                    İptal
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    aria-label={`${meta.label} rızası al`}
                    disabled={type.startsWith("biometric_") && biometricModule?.enabled !== true}
                    onClick={() => setGrantingType(type)}
                    className="max-sm:min-h-11 gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Rıza al
                  </Button>
                )}
              </div>}
            </div>
          );
        })}
      </div>

      {canManageConsents && (
        <>
          <Dialog
            open={grantingType !== null}
            onOpenChange={(open) => {
              if (!open) {
                setGrantingType(null);
                setNotes("");
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {grantingType ? CONSENT_META[grantingType].label : ""} — Rıza Kaydı
                </DialogTitle>
                <DialogDescription>
                  Bu işlem çalışanın ayrı alınmış açık rıza beyanını kaydeder. Biyometri yalnız erişim kontrolü içindir.
                  Çalışan istediği zaman geri alabilir.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <label htmlFor={notesId} className="text-xs font-medium">Not (opsiyonel)</label>
                <Textarea id={notesId}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Örn: Çalışan imzalı form arşivde, ref #1234"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button className="max-sm:min-h-11"
                  variant="outline"
                  onClick={() => {
                    setGrantingType(null);
                    setNotes("");
                  }}
                  disabled={submitting}
                >
                  İptal
                </Button>
                <Button className="max-sm:min-h-11" onClick={handleGrant} disabled={submitting || (grantingType?.startsWith("biometric_") === true && biometricModule?.enabled !== true)}>
                  {submitting ? "Kaydediliyor..." : "Rıza al"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ConfirmDestructive open={revokeTarget !== null} onOpenChange={open => { if (!open) setRevokeTarget(null); }}
            title="Rıza iptal edilsin mi?" objectName={revokeTarget?.label ?? "Rıza"}
            effects={["Rıza kaydı geri alınmış olarak işaretlenir. Mevcut biyometrik şablonlar bu işlemle silinmez."]}
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
