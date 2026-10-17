import { useNavigate } from "react-router-dom";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import StatsGrid from "@/components/dashboard/StatsGrid";
import ActivitySummaryCard from "@/components/dashboard/ActivitySummaryCard";
import RecentReadingsTable from "@/components/dashboard/RecentReadingsTable";
import QuickLinksGrid from "@/components/dashboard/QuickLinksGrid";
import { EmptyState } from "@/components/shared/EmptyState";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";

export default function Index() {
  const { activeProject, projectId, projects, loading, isSuperAdmin } = useActiveProject();
  const navigate = useNavigate();
  const noProject = !loading && !projectId;
  return <div className="mx-auto max-w-[1536px] space-y-7">
    <DashboardHeader projectName={activeProject?.name} />
    {noProject ? <EmptyState title={projects.length ? "Bir proje seçin" : isSuperAdmin ? "Henüz aktif proje yok" : "Proje ataması bekleniyor"}
      description={projects.length ? "Proje özetini görmek için erişebildiğiniz projelerden birini seçin." : isSuperAdmin ? "Projeleri Admin sayfasından kontrol edebilirsiniz." : "Henüz erişebileceğiniz bir proje yok. Projeye atanmak için yöneticinizle iletişime geçin."}
      action={{ label: projects.length ? "Proje seç" : isSuperAdmin ? "Admin sayfasını aç" : "Profilimi aç", onClick: () => projects.length ? document.getElementById("project-switcher")?.click() : navigate(isSuperAdmin ? "/system-admin" : "/profile") }} /> : <div key={projectId ?? "loading"} className="space-y-[30px]">
      <QuerySectionBoundary title="Proje istatistikleri alınamadı" resetKey={projectId}><StatsGrid /></QuerySectionBoundary>
      <div className="grid gap-7 min-[1000px]:grid-cols-[1.35fr_1fr] min-[1000px]:gap-12">
        <QuerySectionBoundary title="Aktivite özeti alınamadı" description="Diğer proje bilgilerini görüntülemeye devam edebilirsiniz." resetKey={projectId}><ActivitySummaryCard /></QuerySectionBoundary>
        <QuickLinksGrid />
      </div>
      <QuerySectionBoundary title="Son kart okumaları alınamadı" resetKey={projectId}><RecentReadingsTable /></QuerySectionBoundary>
    </div>}
    <footer className="flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground"><span>{activeProject?.name ?? "Proje seçilmedi"}</span><span>İstanbul saati (UTC+3)</span></footer>
  </div>;
}
