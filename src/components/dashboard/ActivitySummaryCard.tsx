import { Link } from "react-router-dom";
import { useDashboardActivity } from "@/hooks/useDashboard";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Button } from "@/components/ui/button";

export default function ActivitySummaryCard() {
  const { summary, loading } = useDashboardActivity();
  const count = (value: number | null) => value === null ? "—" : `${value.toLocaleString("tr-TR")} kişi`;
  const rows = summary ? [
    ["Çalışma saatleri", summary.workHours ?? "Tanımlanmamış"],
    ["Ortalama ilk giriş", summary.averageFirstEntry ?? "Henüz giriş yok"],
    ["Ortalama son çıkış", summary.averageLastExit ?? "Henüz çıkış yok"],
    ["Bugünkü geç kalanlar", count(summary.lateArrivals)],
    ["Bugün mevcut personel", count(summary.presentToday)],
  ] : [];
  return <><h2 className="text-base font-semibold">Aktivite özeti / Bugün</h2><p className="mt-1 text-xs text-muted-foreground">İstanbul saati · İzin verilen personel okumaları</p>
    {loading ? <SectionSkeleton rows={3} label="Aktivite özeti yükleniyor" className="mt-4" /> : !summary || summary.presentToday === null ? <>
      <EmptyState compact title="Bugün özetlenecek okuma yok" description="Aktif personele ait izin verilen bir okuma geldiğinde özet burada görünür." />
      <Button asChild variant="outline"><Link to="/pdks-records">PDKS kayıtlarını aç</Link></Button>
    </> : <dl className="mt-4 grid grid-cols-2">{rows.map(([label, value], index) => <div key={label} className={`border-b py-2.5 ${index % 2 === 1 ? "pl-4 min-[761px]:pl-6" : ""} ${index === rows.length - 1 ? "col-span-2 flex items-center justify-between" : ""}`}><dt className="text-xs text-muted-foreground">{label}</dt><dd className={`font-[550] tabular-nums ${index === rows.length - 1 ? "" : "mt-1 text-[15px]"}`}>{value}</dd></div>)}</dl>}
  </>;
}
