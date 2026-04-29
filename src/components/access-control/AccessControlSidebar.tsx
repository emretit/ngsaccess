import { Shield, Clock, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessControlSidebarProps {
  selected: string;
  onSelect: (val: string) => void;
}

const sidebarItems = [
  {
    key: "unified",
    label: "Erişim Yönetimi",
    icon: Shield,
  },
  {
    key: "temporary",
    label: "Geçici Erişim",
    icon: Clock,
  },
  {
    key: "readings",
    label: "Kart Okutma Geçmişi",
    icon: History,
  },
];

export function AccessControlSidebar({ selected, onSelect }: AccessControlSidebarProps) {
  return (
    <div className="h-full w-[240px] shrink-0 bg-card rounded-xl border shadow-xs">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-primary">Geçiş Kontrol</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1.5">Menü</p>
      </div>
      <nav className="p-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
        <ul className="space-y-0.5">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isSelected = selected === item.key;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onSelect(item.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
