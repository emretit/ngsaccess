
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import UnifiedRuleTable from "./UnifiedRuleTable";
import { useState } from "react";
import { UnifiedRuleForm } from "./UnifiedRuleForm";

const UnifiedAccessControl = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Removed outer "Erişim Kuralları" title, as requested! */}
      <div className="flex justify-end items-center">
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Kural
        </Button>
      </div>
      {/* Modal Form */}
      <UnifiedRuleForm open={open} onOpenChange={setOpen} />

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-6">
          <UnifiedRuleTable />
        </div>
      </div>
    </div>
  );
};

export default UnifiedAccessControl;
