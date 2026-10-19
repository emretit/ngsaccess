import { useId, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { api } from "../../../../../convex/_generated/api";
import { destructionSummary, validateDestructionInput, type BiometricKind } from "../../../../../convex/lib/biometricDestruction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useSettingsFormState } from "../../SettingsFormState";
import { errorMessage, notify } from "@/lib/notify";

export const DESTRUCTION_WARNING = "Bu işlem geri alınamaz. Çalışan, kart ve okuma geçmişi silinmez; yalnız biyometrik şablonlar silinir.";
export function destructionStatusLabel(run: { status: string; deviceOperations: number; deviceFailures: number; deviceUnconfirmed: number }): string {
  if (run.status === "running") return "İmha sürüyor";
  if (run.status === "waitingDevices") return "Cihaz onayı bekleniyor";
  if (run.status === "failed") return "İşlem kesildi";
  if (run.deviceOperations === 0) return "Convex'ten silindi; cihazlardaki şablonlar ayrıca silinmeli";
  return run.deviceFailures || run.deviceUnconfirmed ? "Cihaz sonucu eksik" : "Tamamlandı";
}

/** Dialog accepts strings; wrap long tokens here without changing the shared component. */
export function dialogExcerpt(text: string): string {
  const trimmed = text.trim();
  const excerpt = trimmed.slice(0, 160) + (trimmed.length > 160 ? "…" : "");
  return excerpt.replace(/(\S{24})(?=\S)/gu, "$1\u200b");
}

type Preview = FunctionReturnType<typeof api.biometricDestruction.previewBiometricDestruction>;

/** Presentational confirmation controls are shared with the render contract tests. */
export function DestructionConfirmationFields({ preview, kinds, reason, confirmText, busy, moduleEnabled, onReason, onConfirmText, onContinue }: {
  preview: Preview | null; kinds: BiometricKind[]; reason: string; confirmText: string; busy: boolean; moduleEnabled: boolean;
  onReason: (value: string) => void; onConfirmText: (value: string) => void; onContinue: () => void;
}) {
  const reasonId = useId();
  const confirmId = useId();
  const valid = preview !== null && validateDestructionInput(preview.projectName, confirmText, reason, kinds) === null;
  const hasTemplates = preview !== null && (preview.capped || preview.faceCount + preview.fingerprintCount > 0);
  return <div className="min-w-0 space-y-3">
    {preview && <>
      <FormFieldWrapper htmlFor={reasonId} label="İmha gerekçesi" hint="3–500 karakter girin." error={reason.length > 0 && (reason.trim().length < 3 || reason.trim().length > 500) ? "Gerekçe 3–500 karakter olmalıdır." : undefined}>
        <Textarea value={reason} onChange={event => onReason(event.target.value)} maxLength={500} disabled={busy} rows={3} />
      </FormFieldWrapper>
      <FormFieldWrapper htmlFor={confirmId} label="Onay için proje adını yazın" hint={preview.projectName} error={confirmText && confirmText !== preview.projectName ? "Proje adı tam olarak eşleşmelidir." : undefined}>
        <Input value={confirmText} onChange={event => onConfirmText(event.target.value)} autoComplete="off" disabled={busy} />
      </FormFieldWrapper>
    </>}
    <Button type="button" variant="destructive" disabled={!valid || !hasTemplates || busy || moduleEnabled} onClick={onContinue}>İmha işlemini onayla</Button>
  </div>;
}

export function BiometricDestructionCard({ projectId }: { projectId: Id<"projects"> }) {
  return <QuerySectionBoundary resetKey={projectId} title="İmha aracı yüklenemedi">
    <BiometricDestructionForm key={projectId} projectId={projectId} />
  </QuerySectionBoundary>;
}

function BiometricDestructionForm({ projectId }: { projectId: Id<"projects"> }) {
  const client = useConvex();
  const start = useMutation(api.biometricDestruction.startBiometricDestruction);
  const latestRun = useQuery(api.biometricDestruction.getDestructionRun, { projectId });
  const module = useQuery(api.privacyBiometric.getBiometricModule, { projectId });
  const [kinds, setKinds] = useState<BiometricKind[]>(["face", "fingerprint"]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const active = latestRun?.status === "running" || latestRun?.status === "waitingDevices";
  const { run: count, pending: counting } = useAsyncAction(async () => {
    setPreview(null);
    const result = await client.query(api.biometricDestruction.previewBiometricDestruction, { projectId, kinds });
    setPreview(result);
    setConfirmText("");
  }, { error: "Biyometrik şablonlar sayılamadı" });
  useSettingsFormState(`destruction-${projectId}`, reason !== "" || confirmText !== "", starting || counting);
  const busy = counting || starting || active;
  if (latestRun === undefined || !module) return <SectionSkeleton label="İmha aracı yükleniyor" />;
  const toggleKind = (kind: BiometricKind) => {
    setKinds(current => current.includes(kind) ? current.filter(value => value !== kind) : [...current, kind]);
    setPreview(null); setConfirmText("");
  };
  return <section className="min-w-0 space-y-4 border-t border-border pt-6" aria-label="Biyometrik şablon imhası">
    <h3 className="text-base font-medium">Biyometrik şablon imhası</h3>
    <p className="text-sm">{DESTRUCTION_WARNING}</p>
    <p className="text-sm text-muted-foreground">Profil fotoğrafları ve rıza kayıtları korunur. Önce yukarıdaki Biyometri modülü bölümünden modülü kapatın. İmha kapsamını ve gerekçesini yasal danışmanınıza doğrulatın.</p>
    <p className="text-sm text-muted-foreground">DS-K2804 köprüsünün mevcut sürümü cihazdan biyometrik silmeyi desteklemiyor. İşlem kuyruğa alınır ve tutanağa yazılır; cihazdan silindiği onaylanmaz. Cihaz hatalarını ve doğrulanamayan sonuçları tutanaktan kontrol edin.</p>
    <p className="text-sm text-muted-foreground">Yalnız Hikvision cihazları hedeflenir. IDE Smart ve diğer marka cihazlardaki şablonlar ayrıca silinmelidir.</p>
    {module.enabled && <p className="text-sm text-warning" role="status">Biyometri modülü açık. Devam etmek için önce modülü kapatın.</p>}
    <fieldset className="flex flex-wrap gap-x-6 gap-y-3" disabled={busy}>
      <legend className="mb-2 text-sm font-medium">Silinecek şablon türleri</legend>
      {(["face", "fingerprint"] as const).map(kind => <label key={kind} className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-primary" checked={kinds.includes(kind)} onChange={() => toggleKind(kind)} />
        {kind === "face" ? "Yüz" : "Parmak izi"}
      </label>)}
    </fieldset>
    <Button variant="outline" type="button" disabled={busy || kinds.length === 0} onClick={() => void count()}>{counting ? "Sayılıyor…" : "Sayım göster"}</Button>
    {preview && <div className="space-y-2 text-sm" role="status">
      <p className="break-words font-medium">{preview.projectName}</p>
      <p className="tabular-nums">Yüz: {preview.faceCount} · Parmak izi: {preview.fingerprintCount} · Çalışan: {preview.employeeCount} · Dosya: {preview.storageFileCount}</p>
      {preview.projectlessTemplateCount > 0 && <p className="text-warning">Projesiz eski şablon: {preview.projectlessTemplateCount}. Bu şablonlar çalışanı bu projeye ait olduğu için sayıldı ve imha kapsamına alındı.</p>}
      {preview.capped && <p className="text-warning">Sayım sınırına ulaşıldı. Bu sayılar alt sınırdır; seçili türlerdeki tüm mevcut şablonlar imha kapsamındadır.</p>}
      {!preview.capped && !preview.faceCount && !preview.fingerprintCount && <p>Seçili türlerde silinecek şablon yok.</p>}
      <p className="text-muted-foreground">Sayım, bu anda kayıtlı şablonları gösterir. Cihaz sonuçları ayrıca doğrulanır; profil fotoğrafıyla ortak dosyalar korunur.</p>
    </div>}
    <DestructionConfirmationFields preview={preview} kinds={kinds} reason={reason} confirmText={confirmText} busy={busy} moduleEnabled={module.enabled}
      onReason={setReason} onConfirmText={setConfirmText} onContinue={() => { setStartError(null); setConfirmOpen(true); }} />
    {startError && <p role="alert" className="break-words text-sm text-destructive">{startError}</p>}
    {latestRun && <div className="space-y-2 border-t border-border pt-4 text-sm" aria-live="polite" aria-busy={active}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-medium">Son imha tutanağı</h4>
        <StatusBadge className="max-w-full whitespace-normal break-words" tone={latestRun.status === "failed" || latestRun.deviceFailures || latestRun.deviceUnconfirmed ? "warning" : active ? "info" : "neutral"}>
          {destructionStatusLabel(latestRun)}
        </StatusBadge>
      </div>
      <p className="break-words">{destructionSummary(latestRun)}</p>
      {latestRun.pendingDeviceChecks > 0 && <p>Cihaz sonuçları tek kontrol zincirinde izleniyor. Çevrimdışı veya uzun süredir bağlantı kurmayan cihazlar doğrulanamadı olarak kaydedilir. Bağlı cihazlarda en fazla 24 saat beklenir.</p>}
      {latestRun.skippedChanged > 0 && <p>İşlem sırasında değiştiği için atlanan şablon: {latestRun.skippedChanged}. Yeni sayım yapın.</p>}
      {latestRun.error && <p role="alert" className="text-destructive">{latestRun.error}</p>}
      <p className="break-words">Gerekçe: {latestRun.reason}</p>
      <p className="break-words text-muted-foreground">Başlatan: {latestRun.userName} · Başlangıç: {new Date(latestRun.startedAt).toLocaleString("tr-TR")}{latestRun.finishedAt ? ` · Bitiş: ${new Date(latestRun.finishedAt).toLocaleString("tr-TR")}` : ""}</p>
    </div>}
    <ConfirmDestructive open={confirmOpen} onOpenChange={setConfirmOpen} title="Biyometrik şablonlar imha edilsin mi?" objectName={dialogExcerpt(preview?.projectName ?? "Seçili proje")}
      effects={[DESTRUCTION_WARNING, `Seçili türler: ${kinds.map(kind => kind === "face" ? "yüz" : "parmak izi").join(", ")}.`, "Cihazdaki silme başarısız olsa bile Convex şablonları silinir; cihaz sonucu tutanağa yazılır.", `Gerekçe: ${dialogExcerpt(reason)}`, ...(startError ? [`İşlem başlatılamadı: ${dialogExcerpt(startError)}`] : [])]}
      confirmLabel="Şablonları kalıcı sil" onConfirm={async () => {
        setStarting(true);
        setStartError(null);
        try {
          if (!preview || module.enabled || active || validateDestructionInput(preview.projectName, confirmText, reason, kinds)) throw new Error("Sayımı ve onay alanlarını tekrar kontrol edin.");
          await start({ projectId, kinds, reason, confirmText });
          notify.success("İmha işlemi başlatıldı", "İlerlemeyi ve cihaz sonuçlarını tutanaktan izleyebilirsiniz.");
          setPreview(null); setConfirmText(""); setReason("");
        } catch (error: unknown) {
          setStartError(errorMessage(error));
          throw error;
        } finally { setStarting(false); }
      }} />
  </section>;
}
