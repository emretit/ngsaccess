
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import UnifiedRuleTable from "./UnifiedRuleTable";

const UnifiedAccessControl = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Erişim Yönetimi</h2>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Erişim Kuralı
        </Button>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-6">
          <UnifiedRuleTable />
        </div>
      </div>
    </div>
  );
};

export default UnifiedAccessControl;
