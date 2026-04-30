
import { useState } from 'react';
import AccessRulesList from './AccessRulesList';
import CreateRuleDialog from './CreateRuleDialog';
import type { AccessRule } from '@/types/access-control';

const UnifiedAccessControl = () => {
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Erişim Yönetimi</h1>
        <p className="text-gray-600">Çalışan erişim kurallarını yönetin</p>
      </div>

      <AccessRulesList 
        onCreateRule={handleCreateRule} 
        onEditRule={handleEditRule}
      />

      <CreateRuleDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        editingRule={editingRule}
        onClose={handleCloseDialog}
      />
    </div>
  );
};

export default UnifiedAccessControl;
