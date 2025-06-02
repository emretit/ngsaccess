
import UnifiedRuleTable from "./UnifiedRuleTable";

const UnifiedAccessControl = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
        <div className="text-sm text-gray-500">
          Yeni kural sistemi yakında...
        </div>
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
