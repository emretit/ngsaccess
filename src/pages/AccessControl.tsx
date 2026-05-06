import { useState } from "react";
import UnifiedAccessControl from "@/components/access-control/unified/UnifiedAccessControl";
import TemporaryAccess from "@/components/access-control/TemporaryAccess";
import CardReadings from "@/components/access-control/CardReadings";
import { AccessControlSidebar } from "@/components/access-control/AccessControlSidebar";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAccessRulesQuery } from "@/hooks/access-rules/useAccessRulesQuery";

const AccessControl = () => {
  const [activeTab, setActiveTab] = useState("unified");
  const { isLoading } = useAccessRulesQuery();

  if (isLoading) {
    return <LoadingSpinner text="Erişim kontrol sistemi yükleniyor..." />;
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 min-h-full">
      <AccessControlSidebar selected={activeTab} onSelect={setActiveTab} />

      <div className="flex-1 min-w-0 overflow-auto">
        {activeTab === "unified" && <UnifiedAccessControl />}
        {activeTab === "temporary" && <TemporaryAccess />}
        {activeTab === "readings" && <CardReadings />}
      </div>
    </div>
  );
};

export default AccessControl;
