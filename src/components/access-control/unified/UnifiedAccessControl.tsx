
import { useState } from "react";
import AccessRulesList from "./AccessRulesList";
import CreateRuleDialog from "./CreateRuleDialog";

const UnifiedAccessControl = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-6">
          <AccessRulesList onCreateRule={() => setShowCreateDialog(true)} />
        </div>
      </div>

      <CreateRuleDialog 
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
};

export default UnifiedAccessControl;
