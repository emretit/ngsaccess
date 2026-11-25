import { useState } from "react";
import { createPortal } from "react-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { formatVisitorTime } from "./visitorTime";

export type VisitorPassSecret = FunctionReturnType<typeof api.visitorPasses.issue>;
type PassProps = { visitorId: Id<"employees">; name: string; expiresAt?: string | null; doors?: string | null };

export function VisitorPassCard({ visitorId, name, expiresAt, doors, secret, onClose }: PassProps & { secret: VisitorPassSecret; onClose: () => void }) {
  const send = useAction(api.actions.visitorPassMail.send);
  const mail = useAsyncAction(async () => {
    const result = await send({ visitorId, token: secret.token, pin: secret.pin });
    if (result.ok) { notify.success("Geçiş kodu e-posta ile gönderildi"); return; }
    const messages = { NO_EMAIL: "Ziyaretçinin e-posta adresi bulunmuyor.", MAIL_NOT_CONFIGURED: "Projenin e-posta ayarları yapılandırılmamış. Yöneticinize başvurun.", PASS_MISMATCH: "Bu kod artık geçerli değil. Kodu yeniden üretin.", SEND_FAILED: "E-posta gönderilemedi. Tekrar deneyin." };
    throw new Error(messages[result.reason]);
  }, { error: "E-posta gönderilemedi" });
  const badge = <div className="visitor-pass-badge space-y-3 text-center">
    <h2 className="break-words text-xl font-semibold">{name}</h2>
    <p className="text-sm">Geçerlilik: {formatVisitorTime(expiresAt)}</p>
    <p className="break-words text-sm">Kapılar: {doors || "Seçilen kapılar"}</p>
    <div className="mx-auto w-fit bg-white p-3"><QRCodeSVG value={secret.token} size={190} level="M" role="img" aria-label="Ziyaretçi geçiş QR kodu" /></div>
    <p className="text-sm">PIN</p><p className="font-mono text-3xl font-semibold tracking-[.2em]">{secret.pin}</p>
  </div>;
  return <section className="min-w-0 space-y-4 p-5" aria-label="Ziyaretçi geçiş kodu">
    <p role="status" className="rounded-md border p-3 text-sm">QR ve PIN yalnız bu ekranda bir kez gösterilir. Kapatmadan önce yazdırın veya e-posta gönderin. Kapatınca tekrar görüntülenemez.</p>
    {badge}
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => window.print()}>Yazdır</Button><Button type="button" variant="outline" disabled={mail.pending} onClick={() => void mail.run()}>{mail.pending ? "Gönderiliyor…" : "E-posta gönder"}</Button><Button type="button" disabled={mail.pending} onClick={onClose}>Kodu kapat</Button></div>
    {typeof document !== "undefined" && createPortal(<div className="visitor-pass-print" aria-hidden="true">{badge}</div>, document.body)}
    <style>{`.visitor-pass-print{display:none}@media print{@page{size:A6 portrait;margin:8mm}body>*{display:none!important}body>.visitor-pass-print{display:block!important;color:#000;background:#fff;width:89mm;font-family:sans-serif;text-align:center}.visitor-pass-print .visitor-pass-badge{display:flex;flex-direction:column;align-items:center;gap:3mm}.visitor-pass-print h2{font-size:18pt}.visitor-pass-print p{margin:0;overflow-wrap:anywhere}.visitor-pass-print svg{width:48mm;height:48mm}.visitor-pass-print .font-mono{font-size:24pt;letter-spacing:4pt}}`}</style>
  </section>;
}

export function VisitorPassManagement(props: PassProps) {
  const pass = useQuery(api.visitorPasses.getForVisitor, { visitorId: props.visitorId });
  const issue = useMutation(api.visitorPasses.issue);
  const regenerate = useMutation(api.visitorPasses.regenerate);
  const revoke = useMutation(api.visitorPasses.revoke);
  const [secret, setSecret] = useState<VisitorPassSecret | null>(null);
  const [confirmation, setConfirmation] = useState<"regenerate" | "revoke" | null>(null);
  const action = useAsyncAction(async () => {
    if (confirmation === "revoke") { await revoke({ visitorId: props.visitorId }); setSecret(null); notify.success("Geçiş kodu iptal edildi"); }
    else setSecret(await (pass ? regenerate : issue)({ visitorId: props.visitorId }));
    setConfirmation(null);
  }, { error: "Geçiş kodu işlemi tamamlanamadı" });
  if (secret) return <VisitorPassCard {...props} secret={secret} onClose={() => setSecret(null)} />;
  return <section className="space-y-3 border-t pt-4" aria-label="QR ve PIN yönetimi">
    <h3 className="font-medium">QR + PIN (kartsız)</h3>
    {pass === undefined ? <p role="status">Geçiş bilgileri yükleniyor…</p> : pass ? <>
      <p className="text-sm">{pass.status === "revoked" ? "İptal edildi" : pass.status === "exhausted" ? "Limit doldu" : "Aktif"} · Kullanılan giriş: {pass.usedCount}</p>
      <p className="text-sm">Limit: {pass.maxUses ?? "Sınırsız"} · Kalan: {pass.maxUses === null ? "Sınırsız" : Math.max(0, pass.maxUses - pass.usedCount)}</p>
      <p className="text-sm">Son kullanım: {pass.lastUsedAt ? formatVisitorTime(pass.lastUsedAt) : "Henüz kullanılmadı"}</p>
    </> : <p className="text-sm">Henüz geçiş kodu oluşturulmadı.</p>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={action.pending || pass === undefined} onClick={() => setConfirmation("regenerate")}>{pass ? "Kodu yeniden üret" : "Kod oluştur"}</Button>{pass && pass.status !== "revoked" && <Button variant="outline" disabled={action.pending} onClick={() => setConfirmation("revoke")}>İptal et</Button>}</div>
    <ConfirmDestructive open={confirmation !== null} onOpenChange={open => { if (!open && !action.pending) setConfirmation(null); }} objectName={props.name} title={confirmation === "revoke" ? "Geçiş kodu iptal edilsin mi?" : "Geçiş kodu oluşturulsun mu?"} confirmLabel={confirmation === "revoke" ? "İptal et" : "Kodu oluştur"} effects={confirmation === "revoke" ? ["Mevcut QR ve PIN artık kullanılamaz."] : ["Önceki QR ve PIN geçersiz olur; giriş sayacı sıfırlanır.", "Yeni QR ve PIN yalnız bir kez gösterilir."]} onConfirm={() => action.run()} />
  </section>;
}
