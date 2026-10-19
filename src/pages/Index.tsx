import { useNavigate } from "react-router-dom";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import TodayStrip from "@/components/dashboard/TodayStrip";
import ReadingsTimeline from "@/components/dashboard/ReadingsTimeline";
import LiveFeed from "@/components/dashboard/LiveFeed";
import DeviceHealth from "@/components/dashboard/DeviceHealth";
import QuickLinksGrid from "@/components/dashboard/QuickLinksGrid";
import { EmptyState } from "@/components/shared/EmptyState";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";

const TWO_COLUMNS = "grid gap-5 min-[1000px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] min-[1000px]:gap-6";

export default function Index() {
  const { activeProject, projectId, projects, loading, isSuperAdmin } = useActiveProject();
  const navigate = useNavigate();
  const noProject = !loading && !projectId;
  return <div className="mx-auto max-w-[1536px] space-y-6">
    <DashboardHeader />
    {noProject ? <EmptyState title={projects.length ? "Bir proje seçin" : isSuperAdmin ? "Henüz aktif proje yok" : "Proje ataması bekleniyor"}
      description={projects.length ? "Proje özetini görmek için erişebildiğiniz projelerden birini seçin." : isSuperAdmin ? "Projeleri Admin sayfasından kontrol edebilirsiniz." : "Henüz erişebileceğiniz bir proje yok. Projeye atanmak için yöneticinizle iletişime geçin."}
      action={{ label: projects.length ? "Proje seç" : isSuperAdmin ? "Admin sayfasını aç" : "Profilimi aç", onClick: () => projects.length ? document.getElementById("project-switcher")?.click() : navigate(isSuperAdmin ? "/system-admin" : "/profile") }} /> : <div key={projectId ?? "loading"} className="space-y-6">
      <QuerySectionBoundary title="Bugünün özeti alınamadı" resetKey={projectId}><TodayStrip /></QuerySectionBoundary>
      <div className={TWO_COLUMNS}>
        <QuerySectionBoundary title="Saatlik okumalar alınamadı" description="Diğer proje bilgilerini görüntülemeye devam edebilirsiniz." resetKey={projectId}><ReadingsTimeline /></QuerySectionBoundary>
        <QuerySectionBoundary title="Son kart okumaları alınamadı" resetKey={projectId}><LiveFeed /></QuerySectionBoundary>
      </div>
      {/* Alt satırda paneller içerik boyunda kalır; cihaz listesi kısaysa boş alan oluşmaz. */}
      <div className={`${TWO_COLUMNS} min-[1000px]:items-start`}>
        <QuerySectionBoundary title="Cihaz durumu alınamadı" resetKey={projectId}><DeviceHealth /></QuerySectionBoundary>
        <QuerySectionBoundary title="Hızlı erişim alınamadı" resetKey={projectId}><QuickLinksGrid /></QuerySectionBoundary>
      </div>
    </div>}
    <footer className="flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground"><span>{activeProject?.name ?? "Proje seçilmedi"}</span><span>İstanbul saati (UTC+3)</span></footer>
  </div>;
}
