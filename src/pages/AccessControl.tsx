import { Link } from "react-router-dom";
import UnifiedAccessControl from "@/components/access-control/unified/UnifiedAccessControl";
import { DeviceSyncStatusBanner } from "@/components/sync/DeviceSyncStatusBanner";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const AccessControl = () => {
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
