import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TemplatesPage from "./templates/TemplatesPage";
import { useState } from "react";
import AccessRulesList from "./AccessRulesList";
import CreateRuleDialog from "./CreateRuleDialog";
import { RuleSaveNotice } from "./SyncRuns";
import type { RuleSaveResult } from "@/hooks/access-rules/useComplexAccessRuleMutations";
import type { AccessRule } from "@/types/access-control";

const ProjectAccessControl = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "templates" ? "templates" : "rules";
  const [saved, setSaved] = useState<RuleSaveResult | null>(null);
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
      {saved && (
        <RuleSaveNotice result={saved} onDismiss={() => setSaved(null)} />
      )}
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value === "templates") next.set("tab", value);
            else {
              next.delete("tab");
              next.delete("template");
            }
            return next;
          })
        }
      >
        <TabsList>
          <TabsTrigger value="rules">Kurallar</TabsTrigger>
          <TabsTrigger value="templates">Zaman Şablonları</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">
          <TemplatesPage />
        </TabsContent>
        <TabsContent value="rules">
          <AccessRulesList
            onCreateRule={handleCreateRule}
            onEditRule={handleEditRule}
          />
        </TabsContent>
      </Tabs>

      {isCreateDialogOpen && (
        <CreateRuleDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          editingRule={editingRule}
          onClose={handleCloseDialog}
          onDiffSaved={setSaved}
        />
      )}
    </div>
  );
};

const UnifiedAccessControl = () => {
  return <ProjectAccessControl />;
};

export default UnifiedAccessControl;
