import { useState } from "react";
import UnifiedAccessControl from "@/components/access-control/unified/UnifiedAccessControl";
import CardReadings from "@/components/access-control/CardReadings";
import { AccessControlSidebar } from "@/components/access-control/AccessControlSidebar";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAccessRulesQuery } from "@/hooks/access-rules/useAccessRulesQuery";
import { DeviceSyncStatusBanner } from "@/components/sync/DeviceSyncStatusBanner";

const AccessControl = () => {
  const [activeTab, setActiveTab] = useState("unified");
  const { isLoading } = useAccessRulesQuery();

  if (isLoading) {
    return <LoadingSpinner text="Erişim kontrol sistemi yükleniyor..." />;
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 min-h-full">
      <AccessControlSidebar selected={activeTab} onSelect={setActiveTab} />

      <div className="flex-1 min-w-0 overflow-auto space-y-3">
        <DeviceSyncStatusBanner />
        {activeTab === "unified" && <UnifiedAccessControl />}
        {activeTab === "readings" && <CardReadings />}
      </div>
    </div>
  );
};

export default AccessControl;
