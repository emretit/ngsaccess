import { Link } from "react-router-dom";
import { StatInline } from "@/components/shared/StatInline";
import { Button } from "@/components/ui/button";
import { useDashboardStats } from "@/hooks/useDashboard";

export default function StatsGrid() {
  const { stats, loading } = useDashboardStats();
  return <><StatInline variant="metrics" loading={loading} items={[
    { label: "Toplam personel", value: stats?.employees },
    { label: "Aktif cihazlar", value: stats?.devices },
    { label: "Bugünkü kart okumaları", value: stats?.cardReadings, description: "İzin verilen + reddedilen" },
    { label: "Pasif erişim kuralları", value: stats?.pendingRequests },
  ]} />{!loading && stats?.employees === 0 && <div className="mt-4 flex flex-wrap items-center gap-3 border-b pb-4"><div className="mr-auto"><p className="font-medium">Henüz personel eklenmemiş</p><p className="text-xs text-muted-foreground">Kişiler sayfasından proje personelini kontrol edin.</p></div><Button asChild variant="outline"><Link to="/employees">Kişileri aç</Link></Button></div>}</>;
}
