
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AccessRulesList from './AccessRulesList';
import ShiftBasedAccessRules from './ShiftBasedAccessRules';
import CreateRuleDialog from './CreateRuleDialog';
import { Clock, Shield } from 'lucide-react';

const UnifiedAccessControl = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('standard');

  const handleCreateRule = () => {
    setEditingRule(null);
    setIsCreateDialogOpen(true);
  };

  const handleEditRule = (rule: any) => {
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
        <p className="text-gray-600">
          Çalışan erişim kurallarını ve vardiya bazlı erişim kontrollerini yönetin
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-lg">
          <TabsTrigger value="standard" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Standart Kurallar
          </TabsTrigger>
          <TabsTrigger value="shift-based" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Vardiya Bazlı
          </TabsTrigger>
        </TabsList>

        <TabsContent value="standard" className="space-y-6">
          <AccessRulesList 
            onCreateRule={handleCreateRule} 
            onEditRule={handleEditRule}
          />
        </TabsContent>

        <TabsContent value="shift-based" className="space-y-6">
          <ShiftBasedAccessRules 
            onCreateRule={handleCreateRule} 
            onEditRule={handleEditRule}
          />
        </TabsContent>
      </Tabs>

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
