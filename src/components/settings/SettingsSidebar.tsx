
import { Settings, Clock, Bell, Mail, Users, FileBarChart } from "lucide-react";

interface SettingsSidebarProps {
  selected: string;
  onSelect: (val: string) => void;
}

const sidebarItems = [
  {
    key: "general",
    label: "Genel",
    icon: Settings,
  },
  {
    key: "users",
    label: "Kullanıcı Yönetimi",
    icon: Users,
  },
  {
    key: "schedule",
    label: "Vardiya Ayarları",
    icon: Clock,
  },
  {
    key: "reports",
    label: "Raporlar",
    icon: FileBarChart,
  },
  {
    key: "mail",
    label: "Mail Ayarları",
    icon: Mail,
  },
  {
    key: "notifications",
    label: "Bildirimler",
    icon: Bell,
  },
];

export function SettingsSidebar({ selected, onSelect }: SettingsSidebarProps) {
  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 pt-6 min-h-full">
      <nav className="flex flex-col gap-2">
        {sidebarItems.map(item => {
          const isSelected = selected === item.key;
          
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`flex items-center gap-3 px-6 py-3 text-left rounded-l-full transition-colors font-medium relative
                ${isSelected 
                  ? 'bg-primary/10 text-primary font-semibold border-r-4 border-r-primary' 
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}
              `}
            >
              <item.icon className={`h-5 w-5 ${isSelected ? 'text-primary' : ''}`} />
              <span className="flex-1">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
