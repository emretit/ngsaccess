
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Shield } from 'lucide-react';
import UnifiedAccess from '@/components/access-control/UnifiedAccess';
import TemporaryAccess from '@/components/access-control/TemporaryAccess';
import ZonesAndDoors from '@/components/access-control/ZonesAndDoors';

const sidebarItems = [
  {
    title: "Erişim Yönetimi",
    value: "unified",
    icon: Shield,
  },
  {
    title: "Geçici Erişim",
    value: "temporary",
    icon: Clock,
  },
  {
    title: "Bölgeler ve Kapılar",
    value: "zones",
    icon: MapPin,
  },
];

const AccessControl = () => {
  const [activeTab, setActiveTab] = useState('unified');

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r">
        <div className="p-4">
          <h1 className="text-lg font-semibold">Geçiş Kontrol</h1>
        </div>
        <nav className="space-y-1 px-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                onClick={() => setActiveTab(item.value)}
                className={cn(
                  'w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  activeTab === item.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.title}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {activeTab === 'unified' && <UnifiedAccess />}
          {activeTab === 'temporary' && <TemporaryAccess />}
          {activeTab === 'zones' && <ZonesAndDoors />}
        </div>
      </div>
    </div>
  );
};

export default AccessControl;
