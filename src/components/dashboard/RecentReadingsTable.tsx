import { Link } from "react-router-dom";
import { useDashboardReadings } from "@/hooks/useDashboard";
import { useAuth } from "@/components/auth/AuthProvider";
import { capabilities } from "@/lib/capabilities";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
export default function RecentReadingsTable() {
  const { readings, loading } = useDashboardReadings();
  const { profile } = useAuth();
  return <div className="overflow-hidden rounded-lg border bg-surface">
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-[18px] min-[761px]:px-5"><h2 className="text-base font-semibold">Son kart okumaları</h2><Link to="/live-monitoring" className="py-1 text-xs font-medium hover:underline">Canlı izlemeyi aç</Link></div>
    {loading ? <SectionSkeleton rows={5} label="Son kart okumaları yükleniyor" className="p-4" /> : !readings.length ? <div className="pb-6">
      <EmptyState compact title="Henüz kart okuma kaydı yok" description={capabilities(profile?.role).admin ? "Cihaz ve personel bağlantılarını kontrol edin. İlk kart okuması burada görünecek." : "Cihaz ve personel bağlantılarını yöneticinizle kontrol edin."} />
      <div className="flex flex-wrap justify-center gap-2 px-4"><Button asChild variant="outline"><Link to="/devices">Cihazları görüntüle</Link></Button><Button asChild variant="outline"><Link to="/employees">Kişileri görüntüle</Link></Button></div>
    </div> : <>
      <Table className="table-fixed text-xs [&_td]:px-3 [&_th]:px-3 min-[761px]:[&_td]:px-4 min-[761px]:[&_th]:px-4" aria-label="Son kart okumaları">
        <TableHeader><TableRow><TableHead className="w-[30%] min-[761px]:w-[24%]">Tarih / Saat</TableHead><TableHead className="w-[37%] min-[761px]:w-[28%]">Personel</TableHead><TableHead className="hidden min-[761px]:table-cell min-[761px]:w-[27%]">Cihaz</TableHead><TableHead className="w-[33%] min-[761px]:w-[21%]">Durum</TableHead></TableRow></TableHeader>
        <TableBody>{readings.map(reading => {
          const date = reading.accessTime ? new Date(reading.accessTime) : null;
          const valid = date && !Number.isNaN(date.getTime());
          const device = reading.devices?.name?.trim() || "Cihaz bilgisi yok";
          const granted = reading.accessStatus === "izin_verildi";
          const denied = reading.accessStatus === "reddedildi";
          return <TableRow key={reading._id} className="max-[760px]:h-[58px]">
            <TableCell className="tabular-nums">{valid ? <><span className="block text-muted-foreground min-[761px]:mr-2 min-[761px]:inline">{dateFormat.format(date)}</span><span>{timeFormat.format(date)}</span></> : "Tarih bilgisi yok"}</TableCell>
            <TableCell className="break-words"><span>{reading.employeeName?.trim() || "Kişi bilgisi yok"}</span><span className="mt-1 block text-[11px] text-muted-foreground min-[761px]:hidden">{device}</span></TableCell>
            <TableCell className="hidden break-words min-[761px]:table-cell">{device}</TableCell>
            <TableCell><StatusBadge tone={granted ? "success" : denied ? "danger" : "neutral"} className="max-[760px]:whitespace-normal">{granted ? "İzin verildi" : denied ? "Reddedildi" : "Durum bilinmiyor"}</StatusBadge></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table><p className="border-t px-4 py-3 text-[11px] text-muted-foreground">Son {readings.length} kayıt · Tüm tarihler</p>
    </>}
  </div>;
}
