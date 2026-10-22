import { usePermissions } from "@/hooks/usePermissions";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useSettingsFormState } from "../../SettingsFormState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { notify } from "@/lib/notify";

export function BridgeIntegrationCard() {
  const { projectId, activeProject } = useActiveProjectScope();
  const isAdmin = usePermissions().can("devices.manage");
  const bridges = useQuery(api.hikBridge.listBridges, projectId && isAdmin ? { projectId } : "skip");
  const createBridge = useMutation(api.hikBridge.createBridge);
  const revokeBridge = useMutation(api.hikBridge.revokeBridge);
  const [revokeTarget, setRevokeTarget] = useState<{ id: Id<"hikBridges">; label: string } | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const create = useAsyncAction(async () => {
    if (!projectId) throw new Error("Önce bir proje seçin.");
    await createBridge({ projectId });
  }, { success: "Köprü anahtarı oluşturuldu", error: "Anahtar oluşturulamadı" });
  const copy = useAsyncAction(async (token: string) => { await navigator.clipboard.writeText(token); },
    { success: "Köprü anahtarı panoya kopyalandı", error: "Anahtar kopyalanamadı" });
  useSettingsFormState("bridge", false, create.pending || revoking);
  const mask = () => "••••••••";
  return <section className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1"><h3 className="text-base font-semibold">Hikvision köprüsü</h3>
        <p className="text-sm text-muted-foreground">Bu projeye ait Windows köprüsünün erişim anahtarlarını yönetin.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDetailsOpen(true)}>Kurulum ayrıntıları</Button>
        <Button onClick={() => void create.run()} disabled={!projectId || bridges === undefined || create.pending || revoking}>{create.pending ? "Oluşturuluyor…" : "Anahtar oluştur"}</Button></div>
    </div>
    {bridges === undefined ? <SectionSkeleton label="Köprü anahtarları yükleniyor" /> : bridges.length === 0 ?
      <EmptyState compact title="Henüz köprü anahtarı oluşturulmadı" description="Windows köprüsünü kurmak için anahtar oluşturun." /> :
      <div className="divide-y border-y">{bridges.map(bridge => {
        const shown = reveal[bridge._id] ?? false;
        return <div key={bridge._id} className="min-w-0 space-y-2 py-4">
          <FormFieldWrapper htmlFor={`bridge-${bridge._id}`} label="Köprü anahtarı">
            <Input readOnly value={shown ? bridge.token : mask()} className="min-w-0 font-mono text-xs" />
          </FormFieldWrapper>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" aria-label={shown ? "Anahtarı gizle" : "Anahtarı göster"} onClick={() => setReveal(previous => ({ ...previous, [bridge._id]: !shown }))}>{shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
            <Button variant="outline" size="icon" aria-label="Anahtarı kopyala" disabled={copy.pending} onClick={() => void copy.run(bridge.token)}><Copy className="h-4 w-4" /></Button>
            <Button variant="outline" disabled={create.pending || revoking} onClick={() => { setRevokeTarget({ id: bridge._id, label: `Anahtar ${mask()}` }); setRevokeOpen(true); }}>Anahtarı iptal et</Button>
          </div>
          <p className="text-xs text-muted-foreground">{bridge.lastSeenAt ? `Son görülme: ${new Date(bridge.lastSeenAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}` : "Henüz bağlanmadı"}. Bu bilgi güncel çevrimiçi durumunu göstermez.</p>
          {bridge.lastClientInfo && <p className="break-all text-xs text-muted-foreground">{bridge.lastClientInfo}</p>}
        </div>;
      })}</div>}
    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}><DialogContent>
      <DialogHeader><DialogTitle>Hikvision köprüsünü kurun</DialogTitle><DialogDescription>{activeProject?.name} · Windows köprüsü</DialogDescription></DialogHeader>
      <ol className="list-decimal space-y-3 pl-5 text-sm"><li>Bu proje için köprü anahtarı oluşturun ve kopyalayın.</li><li>Windows köprüsünün yerel kurulum ekranında anahtarı girin.</li><li>Panel IP adresini ve parolasını Cihazlar sayfasında tanımlayın.</li></ol>
      <details className="text-sm"><summary>Teknik kurulum bilgisi</summary><p className="mt-2 break-all text-muted-foreground">Yerel adres: http://127.0.0.1:8787/__bridge</p><p className="mt-2 text-muted-foreground">Bir köprü bu projedeki localBridge panellerini tek anahtarla yönetir.</p></details>
    </DialogContent></Dialog>
    <ConfirmDestructive open={revokeOpen} onOpenChange={setRevokeOpen} title="Köprü anahtarı iptal edilsin mi?" objectName={revokeTarget?.label ?? "Köprü anahtarı"}
      effects={["Bu anahtarla çalışan köprü artık bağlanamaz.", "Bağlı panellerin köprü üzerinden iletişimi kesilir."]} confirmLabel="Anahtarı iptal et" onConfirm={async () => {
        if (!revokeTarget) throw new Error("İptal edilecek anahtar seçilmedi");
        setRevoking(true);
        try { await revokeBridge({ bridgeId: revokeTarget.id }); notify.success("Köprü anahtarı iptal edildi"); } finally { setRevoking(false); }
      }} />
  </section>;
}
