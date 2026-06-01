import UnifiedAccessControl from "@/components/access-control/unified/UnifiedAccessControl";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAccessRulesQuery } from "@/hooks/access-rules/useAccessRulesQuery";
import { DeviceSyncStatusBanner } from "@/components/sync/DeviceSyncStatusBanner";

const AccessControl = () => {
  const { isLoading } = useAccessRulesQuery();

  if (isLoading) {
    return <LoadingSpinner text="Erişim kontrol sistemi yükleniyor..." />;
  }

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <DeviceSyncStatusBanner />
      <UnifiedAccessControl />
    </div>
  );
};

export default AccessControl;
