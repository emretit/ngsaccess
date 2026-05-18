import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
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
import { useToast } from "@/hooks/use-toast";

type ConsentType = "biometric_face" | "biometric_fingerprint" | "card" | "photo";

const CONSENT_META: Record<
  ConsentType,
  { label: string; description: string; icon: typeof ScanFace; required: boolean }
> = {
  biometric_face: {
    label: "Yüz Tanıma",
    description: "Özel nitelikli — KVKK 6/3 açık rıza zorunlu",
    icon: ScanFace,
    required: true,
  },
  biometric_fingerprint: {
    label: "Parmak İzi",
    description: "Özel nitelikli — KVKK 6/3 açık rıza zorunlu",
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
  const consents = useQuery(api.employeeConsents.listForEmployee, { employeeId });
  const grant = useMutation(api.employeeConsents.grant);
  const revoke = useMutation(api.employeeConsents.revoke);
  const { toast } = useToast();

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
    if (!grantingType) return;
    setSubmitting(true);
    try {
      await grant({
        employeeId,
        consentType: grantingType,
        notes: notes.trim() || undefined,
      });
      toast({
        title: "Rıza alındı",
        description: CONSENT_META[grantingType].label,
      });
      setGrantingType(null);
      setNotes("");
    } catch (e) {
      toast({
        title: "Rıza alınamadı",
        description: e instanceof Error ? e.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: Id<"employeeConsents">, label: string) => {
    try {
      await revoke({ id });
      toast({ title: "Rıza iptal edildi", description: label });
    } catch (e) {
      toast({
        title: "İptal edilemedi",
        description: e instanceof Error ? e.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  };

  if (consents === undefined) {
    return <div className="text-xs text-muted-foreground">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-medium">KVKK Rızalar</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Biyometrik veri için açık rıza zorunludur. Rıza yoksa yüz/parmak izi kaydı eklenemez.
      </p>
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
                    <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500 text-xs">
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
                    Alındı: {format(new Date(active.grantedAt), "dd MMM yyyy HH:mm", { locale: tr })}
                    {active.notes && <span> · {active.notes}</span>}
                  </div>
                )}
              </div>
              <div className="shrink-0">
                {active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRevoke(active.id, meta.label)}
                    className="gap-1.5"
                  >
                    <ShieldX className="h-3.5 w-3.5" />
                    İptal
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setGrantingType(type)}
                    className="gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Rıza Al
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
              Bu işlem KVKK 6698 sayılı kanun kapsamında açık rıza beyanı olarak kaydedilir.
              Çalışan istediği zaman geri alabilir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium">Not (opsiyonel)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Örn: Çalışan imzalı form arşivde, ref #1234"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setGrantingType(null);
                setNotes("");
              }}
              disabled={submitting}
            >
              İptal
            </Button>
            <Button onClick={handleGrant} disabled={submitting}>
              {submitting ? "Kaydediliyor..." : "Rıza Al"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
