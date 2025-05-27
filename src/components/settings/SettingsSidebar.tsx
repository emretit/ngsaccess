
import { Settings, Clock, Bell, Mail, Users, Shield } from "lucide-react";

interface SettingsSidebarProps {
  selected: string;
  onSelect: (val: string) => void;
  showAdmin?: boolean;
}

const sidebarItems = [
  {
    key: "general",
    label: "Genel",
    icon: Settings
  },
  {
    key: "users",
    label: "Kullanıcı Yönetimi",
    icon: Users
  },
  {
    key: "schedule",
    label: "Çalışma Saatleri", 
    icon: Clock
  },
  {
    key: "mail",
    label: "Mail Ayarları",
    icon: Mail
  },
  {
    key: "notifications",
    label: "Bildirimler",
    icon: Bell
  }
];

const adminItem = {
  key: "admin",
  label: "Sistem Yönetimi",
  icon: Shield
};

export function SettingsSidebar({ selected, onSelect, showAdmin = false }: SettingsSidebarProps) {
  const allItems = showAdmin ? [...sidebarItems, adminItem] : sidebarItems;

  return (
    <aside className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 pt-6 min-h-full">
      <nav className="flex flex-col gap-2">
        {allItems.map(item => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={`flex items-center gap-3 px-6 py-3 text-left rounded-l-full transition-colors font-medium
              ${selected === item.key 
                ? 'bg-[#711A1A]/10 text-[#711A1A] dark:text-[#f2b4b4] font-semibold border-r-4 border-r-[#711A1A] dark:border-r-[#f2b4b4]' 
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}
              ${item.key === 'admin' ? 'border-t border-gray-200 dark:border-gray-700 mt-2 pt-4' : ''}
            `}
          >
            <item.icon className={`h-5 w-5 ${selected === item.key ? 'text-[#711A1A] dark:text-[#f2b4b4]' : ''}`} />
            {item.label}
            {item.key === 'admin' && (
              <span className="ml-auto text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                Admin
              </span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  );
}
