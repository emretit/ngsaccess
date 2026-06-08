import { Link } from "react-router-dom";
import UnifiedAccessControl from "@/components/access-control/unified/UnifiedAccessControl";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAccessRulesQuery } from "@/hooks/access-rules/useAccessRulesQuery";
import { DeviceSyncStatusBanner } from "@/components/sync/DeviceSyncStatusBanner";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const AccessControl = () => {
  const { isLoading } = useAccessRulesQuery();

  if (isLoading) {
    return <LoadingSpinner text="Erişim kontrol sistemi yükleniyor..." />;
  }

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/home">Ana Sayfa</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Geçiş Kontrol</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <DeviceSyncStatusBanner />
      <UnifiedAccessControl />
    </div>
  );
};

export default AccessControl;
