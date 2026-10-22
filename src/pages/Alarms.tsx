import { usePermissions } from "@/hooks/usePermissions";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notify } from "@/lib/notify";
import { alarmListArgs, AlarmAcknowledgeButton, AlarmFilters, type AlarmFiltersValue } from "@/components/alarms/AlarmFilters";
import { AlarmEmailStatus } from "@/components/alarms/AlarmEmailStatus";

function OfflineDuration({ rawData }: { rawData: string }) {
  let data: unknown;
  try {
    data = JSON.parse(rawData);
  } catch { return null; }
  if (typeof data !== "object" || data === null || !("durationMs" in data) || typeof data.durationMs !== "number" || !Number.isFinite(data.durationMs)) return null;
  return <p className="text-xs text-muted-foreground">Çevrimdışı süre: {Math.max(1, Math.round(data.durationMs / 60_000))} dakika</p>;
}

type Category = "alarm" | "exception";
type Settings = { emailEnabled: boolean; recipients: string[]; minSeverity: "warning" | "critical" };

function AlarmSettingsDialog({ projectId, open, onOpenChange }: { projectId: Id<"projects">; open: boolean; onOpenChange: (open: boolean) => void }) {
  const current = useQuery(api.alarms.getSettings, open ? { projectId } : "skip");
  const save = useMutation(api.alarms.saveSettings);
  const testEmail = useMutation(api.alarms.testEmail);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [minimum, setMinimum] = useState<Settings["minSeverity"] | null>(null);
  const [recipients, setRecipients] = useState<string[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const savedEnabled = current?.emailEnabled;
  const savedMinimum = current?.minSeverity;
  const savedRecipients = current?.recipients.join(",");
  useEffect(() => {
    if (!open || savedEnabled === undefined || savedMinimum === undefined || savedRecipients === undefined) return;
    setEnabled(savedEnabled); setMinimum(savedMinimum); setRecipients(savedRecipients ? savedRecipients.split(",") : []);
  }, [open, savedEnabled, savedMinimum, savedRecipients]);
  const values = current ? { emailEnabled: enabled ?? current.emailEnabled, minSeverity: minimum ?? current.minSeverity, recipients: recipients ?? current.recipients } : null;
  const addRecipient = () => {
    const email = draft.trim().replace(/,$/, "").toLowerCase();
    if (!email || !values || values.recipients.includes(email)) { setDraft(""); return; }
    if (values.recipients.length >= 8) { notify.error("En fazla 8 alıcı ekleyebilirsiniz"); return; }
    setRecipients([...values.recipients, email]); setDraft("");
  };
  const handleSave = async () => {
    if (!values) return;
    setSaving(true);
    try {
      await save({ projectId, ...values });
      notify.success("Bildirim ayarları kaydedildi"); onOpenChange(false);
    } catch (error) { notify.error("Ayarlar kaydedilemedi", error); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Alarm bildirim ayarları</DialogTitle><DialogDescription>Bu proje için e-posta alıcılarını ve gönderim eşiğini yönetin.</DialogDescription></DialogHeader>
    {!values ? <SectionSkeleton rows={3} label="Bildirim ayarları yükleniyor." /> : <div className="space-y-4">
      <label className="flex items-center gap-2"><input type="checkbox" checked={values.emailEnabled} onChange={event => setEnabled(event.target.checked)} />E-posta bildirimleri açık</label>
      <label className="block text-sm">Minimum önem <select className="ml-2 rounded border bg-background p-2" value={values.minSeverity} onChange={event => setMinimum(event.target.value as Settings["minSeverity"])}><option value="warning">Uyarı</option><option value="critical">Kritik</option></select></label>
      <div><label className="block text-sm" htmlFor="alarm-recipient">Alıcılar (en fazla 8)</label><div className="mt-1 flex gap-2"><input id="alarm-recipient" className="min-w-0 flex-1 rounded border bg-background p-2" type="email" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addRecipient(); } }} placeholder="ornek@sirket.com" /><Button type="button" variant="outline" onClick={addRecipient}>Ekle</Button></div>
        <ul className="mt-2 flex flex-wrap gap-2">{values.recipients.map(email => <li key={email} className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm">{email}<button type="button" aria-label={`${email} alıcısını kaldır`} onClick={() => setRecipients(values.recipients.filter(item => item !== email))}>×</button></li>)}</ul>
      </div>
    </div>}
    <section aria-label="Son alarm e-postası" className="space-y-2 rounded border p-3">
      <h3 className="text-sm font-medium">Son gönderim {current?.lastEmail?.test ? "(test)" : ""}</h3>
      <AlarmEmailStatus delivery={current?.lastEmail} />
      <p className="text-xs text-muted-foreground">Servis kabulü, alıcının gelen kutusuna teslim edildiği anlamına gelmez. Başarısız alıcılara 5 dakika sonra yalnız bir kez daha gönderilir. Test için kayıtlı ayarlar kullanılır; 5 dakikada bir test yapılabilir.</p>
      <Button variant="outline" disabled={testing || saving || !current?.emailEnabled || !current.recipients.length} onClick={async () => {
        setTesting(true);
        try { await testEmail({ projectId }); notify.success("Test e-postası kuyruğa alındı"); }
        catch (error) { notify.error("Test e-postası gönderilemedi", error); }
        finally { setTesting(false); }
      }}>{testing ? "Kuyruğa alınıyor…" : "Test e-postası gönder"}</Button>
    </section>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button><Button disabled={!values || saving} onClick={() => void handleSave()}>{saving ? "Kaydediliyor…" : "Kaydet"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

export default function Alarms() {
  const [searchParams] = useSearchParams();
  const { projectId, activeProject, loading } = useActiveProjectScope();
  const { can } = usePermissions();
  const canManage = can("alarms.ack");
  const [category, setCategory] = useState<Category>("alarm");
  const [filters, setFilters] = useState<AlarmFiltersValue>({ status: "open", severity: "", deviceId: "", fromDay: "", toDay: "" });
  const { status } = filters;
  const [selected, setSelected] = useState<Id<"deviceEvents">[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(searchParams.get("settings") === "notifications");
  const summary = useQuery(api.alarms.summary, projectId ? { projectId } : "skip");
  const devices = useQuery(api.devices.list, projectId ? { projectId } : "skip");
  const acknowledge = useMutation(api.alarms.acknowledge);
  const { results, status: pageStatus, loadMore } = usePaginatedQuery(api.alarms.list,
    projectId ? alarmListArgs(projectId, category, filters) : "skip", { initialNumItems: 50 });
  const acknowledgeRows = async (ids: Id<"deviceEvents">[]) => {
    try { await acknowledge({ ids }); setSelected(current => current.filter(id => !ids.includes(id))); notify.success("Olay onaylandı"); }
    catch (error) { notify.error("Olay onaylanamadı", error); }
  };
  if (loading) return <div className="space-y-6"><PageHeader title="Alarmlar" /><SectionSkeleton rows={5} label="Alarmlar yükleniyor." /></div>;
  if (!projectId) return <div className="space-y-6"><PageHeader title="Alarmlar" /><EmptyState title="Bir proje seçin" description="Alarm kayıtlarını görmek için üst çubuktan proje seçin." /></div>;
  return <div className="min-w-0 space-y-6">
    <PageHeader title="Alarmlar" scope={activeProject?.name ?? "Seçili proje"} />
    <p className="text-sm text-muted-foreground">Çevrimdışı arızaları yeni sinyal geldiğinde süreleriyle kaydedilir ve bağlantının geri geldiği işaretlenir. Hik gateway sessizliği tek başına arıza sayılmaz.</p>
    <section aria-label="Son yedi gün" className="flex gap-6 rounded-lg border border-line p-4 text-sm"><span>Kritik açık: <strong>{summary?.critical ?? "—"}{summary?.capped ? "+" : ""}</strong></span><span>Uyarı açık: <strong>{summary?.warning ?? "—"}{summary?.capped ? "+" : ""}</strong></span></section>
    <div className="flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label="Olay türü" className="flex gap-2"><Button variant={category === "alarm" ? "default" : "outline"} onClick={() => setCategory("alarm")}>Alarm</Button><Button variant={category === "exception" ? "default" : "outline"} onClick={() => setCategory("exception")}>Arıza / İstisna</Button></div>
      <AlarmFilters value={filters} devices={devices ?? []} onChange={setFilters} />
      {can("admin.manage") && <Button variant="outline" onClick={() => setSettingsOpen(true)}>Bildirim ayarları</Button>}{canManage && status !== "acked" && <Button disabled={!selected.length} onClick={() => void acknowledgeRows(selected)}>Seçilenleri onayla ({selected.length})</Button>}
    </div>
    {pageStatus === "LoadingFirstPage" ? <SectionSkeleton rows={5} label="Olaylar yükleniyor." /> : results.length === 0 ? <EmptyState title={pageStatus === "CanLoadMore" ? "Daha fazla yükle" : "Olay bulunamadı"} description={pageStatus === "CanLoadMore" ? "Tarama sınırına ulaşıldı. Daha fazla olay için aşağıdaki düğmeyi kullanın." : "Seçili filtrelerde gösterilecek olay yok."} /> : <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full text-left text-sm"><thead className="bg-subtle"><tr>{canManage && <th className="p-3">Seç</th>}<th className="p-3">Zaman</th><th className="p-3">Cihaz</th><th className="p-3">Olay</th><th className="p-3">Önem</th><th className="p-3">Durum</th>{can("admin.manage") && <th className="p-3">E-posta</th>}{canManage && <th className="p-3">İşlem</th>}</tr></thead><tbody>{results.map(row => <tr key={row._id} className="border-t border-line">{canManage && <td className="p-3">{!row.ackedAt && <input aria-label={`${row.label} seç`} type="checkbox" checked={selected.includes(row._id)} onChange={event => setSelected(current => event.target.checked ? [...current, row._id] : current.filter(id => id !== row._id))} />}</td>}<td className="p-3">{new Date(row.eventTime).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</td><td className="p-3">{row.deviceName}</td><td className="p-3">{row.label}{row.resolvedAt && <p className="text-xs text-muted-foreground">Bağlantı geri geldi · {new Date(row.resolvedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p>}{row.resolvedAt && row.rawData && <OfflineDuration rawData={row.rawData} />}</td><td className="p-3"><span className={row.severity === "critical" ? "text-danger" : row.severity === "warning" ? "text-warning" : "text-muted-foreground"}>{row.severity === "critical" ? "Kritik" : row.severity === "warning" ? "Uyarı" : "Bilgi"}</span></td><td className="p-3">{row.ackedAt ? `Onaylandı · ${new Date(row.ackedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}` : "İnceleme bekliyor"}</td>{can("admin.manage") && <td className="p-3"><AlarmEmailStatus delivery={{ status: row.alarmEmailStatus, attempts: row.alarmEmailAttempts, at: row.alarmEmailAttemptAt ?? row.alarmQueuedAt, error: row.alarmEmailError, retryAt: row.alarmEmailRetryAt }} /></td>}{canManage && <td className="p-3">{!row.ackedAt && <AlarmAcknowledgeButton onAcknowledge={() => void acknowledgeRows([row._id])} />}</td>}</tr>)}</tbody></table></div>}
    {pageStatus === "CanLoadMore" && <Button variant="outline" onClick={() => loadMore(50)}>Daha fazla yükle</Button>}
    {can("admin.manage") && <AlarmSettingsDialog key={projectId} projectId={projectId} open={settingsOpen} onOpenChange={setSettingsOpen} />}
  </div>;
}
