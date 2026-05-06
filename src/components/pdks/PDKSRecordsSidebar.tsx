
import { Users, Table, Building2, List, MessageSquare } from "lucide-react";

interface PDKSRecordsSidebarProps {
  selected: string;
  onSelect: (val: string) => void;
}

const sidebarItems = [
  {
    key: "summary",
    label: "Özet",
    icon: List
  },
  {
    key: "attendance",
    label: "Devam Tablosu",
    icon: Table
  },
  {
    key: "department",
    label: "Departman",
    icon: Building2
  },
  {
    key: "detailed",
    label: "Detaylı",
    icon: Users
  },
  {
    key: "ai-report",
    label: "AI Rapor",
    icon: MessageSquare
  }
];

export function PDKSRecordsSidebar({ selected, onSelect }: PDKSRecordsSidebarProps) {
  return (
    <aside className="w-56 bg-card border-r border-border pt-6 min-h-full">
      <nav className="flex flex-col gap-2">
        {sidebarItems.map(item => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={`flex items-center gap-3 px-6 py-3 text-left rounded-l-full transition-colors font-medium
              ${selected === item.key 
                ? 'bg-primary/10 text-primary font-semibold border-r-4 border-r-primary' 
                : 'text-foreground hover:bg-muted'}
            `}
          >
            <item.icon className={`h-5 w-5 ${selected === item.key ? 'text-primary' : ''}`} />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
