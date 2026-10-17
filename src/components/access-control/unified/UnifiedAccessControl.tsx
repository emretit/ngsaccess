import { useState } from "react";
import AccessRulesList from "./AccessRulesList";
import CreateRuleDialog from "./CreateRuleDialog";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import type { AccessRule } from "@/types/access-control";

const ProjectAccessControl = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AccessRule | null>(null);

  const handleCreateRule = () => {
    setEditingRule(null);
    setIsCreateDialogOpen(true);
  };

  const handleEditRule = (rule: AccessRule) => {
    setEditingRule(rule);
    setIsCreateDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingRule(null);
  };

  return (
    <div className="space-y-6">
      <AccessRulesList
        onCreateRule={handleCreateRule}
        onEditRule={handleEditRule}
      />

      {isCreateDialogOpen && (
        <CreateRuleDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          editingRule={editingRule}
          onClose={handleCloseDialog}
        />
      )}
    </div>
  );
};

const UnifiedAccessControl = () => {
  const { projectId } = useActiveProjectScope();
  return <ProjectAccessControl key={projectId ?? "no-project"} />;
};

export default UnifiedAccessControl;
