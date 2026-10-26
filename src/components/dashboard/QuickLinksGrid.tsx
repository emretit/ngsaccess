import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useDashboardStats } from "@/hooks/useDashboard";
import { visibleRoutes } from "@/lib/routeMeta";
import { DashboardPanel } from "./DashboardPanel";

type Stats = ReturnType<typeof useDashboardStats>["stats"];

const links: { href: string; description: (stats: Stats) => string }[] = [
  { href: "/employees", description: (stats) => stats ? `${stats.employees.toLocaleString("tr-TR")} kişi kayıtlı` : "Proje personelini görüntüleyin" },
  { href: "/access-control", description: (stats) => stats?.pendingRequests ? `${stats.pendingRequests.toLocaleString("tr-TR")} pasif erişim kuralı` : "Erişim kurallarını yönetin" },
  { href: "/pdks-records", description: () => "Giriş çıkış kayıtlarını inceleyin" },
  { href: "/reports", description: () => "Devam raporlarını oluşturun" },
  { href: "/settings", description: () => "Proje ayarlarını yapılandırın" },
];

export default function QuickLinksGrid() {
  const { can } = usePermissions();
  const { stats } = useDashboardStats();
  const routes = visibleRoutes(undefined, false, can);
  return (
    <DashboardPanel title="Hızlı erişim">
      <ul className="divide-y">
        {links.map((link) => {
          const route = routes.find((item) => item.href === link.href);
          if (!route) return null;
          const Icon = route.icon;
          return (
            <li key={route.href}>
              <Link to={route.href} className="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-subtle min-[761px]:px-5">
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{route.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{link.description(stats)}</span>
                </span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </DashboardPanel>
  );
}
