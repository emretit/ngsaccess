
import { Settings, Building2, Clock, Bell } from "lucide-react";

interface SettingsSidebarProps {
  selected: string;
  onSelect: (val: string) => void;
}

const sidebarItems = [
  {
    key: "company",
    label: "Şirket",
    icon: Building2
  },
  {
    key: "general",
    label: "Genel",
    icon: Settings
  },
  {
    key: "schedule",
    label: "Çalışma Saatleri", 
    icon: Clock
  },
  {
    key: "notifications",
    label: "Bildirimler",
    icon: Bell
  }
];

export function SettingsSidebar({ selected, onSelect }: SettingsSidebarProps) {
  return (
    <aside className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 pt-6 min-h-full">
      <nav className="flex flex-col gap-2">
        {sidebarItems.map(item => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={`flex items-center gap-3 px-6 py-3 text-left rounded-l-full transition-colors font-medium
              ${selected === item.key 
                ? 'bg-[#711A1A]/10 text-[#711A1A] dark:text-[#f2b4b4] font-semibold border-r-4 border-r-[#711A1A] dark:border-r-[#f2b4b4]' 
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}
            `}
          >
            <item.icon className={`h-5 w-5 ${selected === item.key ? 'text-[#711A1A] dark:text-[#f2b4b4]' : ''}`} />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
