
import { Users, Table, Building2, List, MessageSquare, FileText } from "lucide-react";

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
    <aside className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 pt-6 min-h-full">
      <nav className="flex flex-col gap-2">
        {sidebarItems.map(item => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={`flex items-center gap-3 px-6 py-3 text-left rounded-l-full transition-colors font-medium
              ${selected === item.key 
                ? 'bg-[#711A1A]/10 text-[#711A1A] dark:text-[#f2b4b4] font-semibold' 
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}
            `}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
