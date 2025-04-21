
import { useState } from 'react';
import UnifiedAccessControl from '@/components/access-control/unified/UnifiedAccessControl';
import TemporaryAccess from '@/components/access-control/TemporaryAccess';
import ZonesAndDoors from '@/components/access-control/ZonesAndDoors';
import { AccessControlSidebar } from '@/components/access-control/AccessControlSidebar';

const AccessControl = () => {
  const [activeTab, setActiveTab] = useState('unified');

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar */}
      <AccessControlSidebar
        selected={activeTab}
        onSelect={setActiveTab}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {activeTab === 'unified' && <UnifiedAccessControl />}
          {activeTab === 'temporary' && <TemporaryAccess />}
          {activeTab === 'zones' && <ZonesAndDoors />}
        </div>
      </div>
    </div>
  );
};

export default AccessControl;
