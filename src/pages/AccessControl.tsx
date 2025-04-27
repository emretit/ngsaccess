
import { useState } from 'react';
import UnifiedAccessControl from '@/components/access-control/unified/UnifiedAccessControl';
import TemporaryAccess from '@/components/access-control/TemporaryAccess';
import CardReadings from '@/components/access-control/CardReadings';
import { AccessControlSidebar } from '@/components/access-control/AccessControlSidebar';
import { useEffect } from 'react';

const AccessControl = () => {
  const [activeTab, setActiveTab] = useState('unified');

  // Log which tab is active for debugging
  useEffect(() => {
    console.log("Active tab:", activeTab);
  }, [activeTab]);

  return (
    <main className="flex-1 p-6 bg-gray-50 flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="flex flex-1 min-h-0">
        <AccessControlSidebar
          selected={activeTab}
          onSelect={setActiveTab}
        />
        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">
            {activeTab === 'unified' && <UnifiedAccessControl />}
            {activeTab === 'temporary' && <TemporaryAccess />}
            {activeTab === 'readings' && <CardReadings />}
          </div>
        </div>
      </div>
    </main>
  );
};

export default AccessControl;
