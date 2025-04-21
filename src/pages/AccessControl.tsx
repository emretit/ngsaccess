
import { useState } from 'react';
import UnifiedAccessControl from '@/components/access-control/unified/UnifiedAccessControl';
import TemporaryAccess from '@/components/access-control/TemporaryAccess';
import ZonesAndDoors from '@/components/access-control/ZonesAndDoors';
import { AccessControlSidebar } from '@/components/access-control/AccessControlSidebar';

const AccessControl = () => {
  const [activeTab, setActiveTab] = useState('unified');

  return (
    <main className="flex-1 p-0 bg-gray-50 flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="flex flex-1 min-h-0">
        <AccessControlSidebar
          selected={activeTab}
          onSelect={setActiveTab}
        />
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            {activeTab === 'unified' && <UnifiedAccessControl />}
            {activeTab === 'temporary' && <TemporaryAccess />}
            {activeTab === 'zones' && <ZonesAndDoors />}
          </div>
        </div>
      </div>
    </main>
  );
};

export default AccessControl;
