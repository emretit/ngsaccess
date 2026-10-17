import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { visibleRoutes } from "@/lib/routeMeta";

const links = [
  { href: "/employees", description: "Projedeki kişi bilgilerini görüntüleyin." },
  { href: "/pdks-records", description: "Personel giriş çıkış kayıtlarını inceleyin." },
  { href: "/settings", description: "Proje ayarlarını yapılandırın." },
];
export default function QuickLinksGrid() {
  const { profile } = useAuth();
  const routes = visibleRoutes(profile?.role);
  return <section><h2 className="text-base font-semibold">Hızlı erişim</h2><div className="mt-4">{links.map(link => {
    const route = routes.find(item => item.href === link.href);
    return route ? <Link key={route.href} to={route.href} className="flex items-center gap-3 border-b py-[13px] hover:bg-subtle"><div><strong className="font-[550]">{route.name}</strong><p className="mt-0.5 text-xs text-muted-foreground">{link.description}</p></div><ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></Link> : null;
  })}</div></section>;
}
