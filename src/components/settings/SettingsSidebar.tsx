
import { Settings, Clock, Bell, Mail, Users, CheckCircle, Circle } from "lucide-react";

interface SettingsSidebarProps {
  selected: string;
  onSelect: (val: string) => void;
  completedSteps?: string[];
  isOnboarding?: boolean;
}

const sidebarItems = [
  {
    key: "general",
    label: "Genel",
    icon: Settings,
    required: true
  },
  {
    key: "users",
    label: "Kullanıcı Yönetimi",
    icon: Users,
    required: true
  },
  {
    key: "schedule",
    label: "Vardiya Ayarları", 
    icon: Clock,
    required: true
  },
  {
    key: "mail",
    label: "Mail Ayarları",
    icon: Mail,
    required: false
  },
  {
    key: "notifications",
    label: "Bildirimler",
    icon: Bell,
    required: false
  }
];

export function SettingsSidebar({ selected, onSelect, completedSteps = [], isOnboarding = false }: SettingsSidebarProps) {
  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 pt-6 min-h-full">
      <nav className="flex flex-col gap-2">
        {sidebarItems.map(item => {
          const isCompleted = completedSteps.includes(item.key);
          const isSelected = selected === item.key;
          
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`flex items-center gap-3 px-6 py-3 text-left rounded-l-full transition-colors font-medium relative
                ${isSelected 
                  ? 'bg-[#711A1A]/10 text-[#711A1A] dark:text-[#f2b4b4] font-semibold border-r-4 border-r-[#711A1A] dark:border-r-[#f2b4b4]' 
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}
              `}
            >
              <item.icon className={`h-5 w-5 ${isSelected ? 'text-[#711A1A] dark:text-[#f2b4b4]' : ''}`} />
              <span className="flex-1">{item.label}</span>
              
              {isOnboarding && (
                <div className="flex items-center gap-1">
                  {item.required && (
                    <span className="text-xs text-red-600 font-medium">*</span>
                  )}
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>
      
      {isOnboarding && (
        <div className="px-6 py-4 mt-4 border-t border-gray-200">
          <div className="text-xs text-gray-600">
            <span className="text-red-600">*</span> Gerekli adımlar
          </div>
        </div>
      )}
    </aside>
  );
}
