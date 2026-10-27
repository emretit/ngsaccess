import { DoorPlansTab } from "../door-plans/DoorPlansTab";
import { usePermissions } from "@/hooks/usePermissions";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StatusPage from "./status/StatusPage";
import { useState } from "react";
import AccessRulesList from "./AccessRulesList";
import CreateRuleDialog from "./CreateRuleDialog";
import { RuleSaveNotice } from "./SyncRuns";
import type { RuleSaveResult } from "@/hooks/access-rules/useComplexAccessRuleMutations";
import type { AccessRule } from "@/types/access-control";

const ProjectAccessControl = () => {
  const [params, setParams] = useSearchParams();
  const { can } = usePermissions();
  const canManage = can("accessRules.manage");
  const tab =
    params.get("tab") === "doors" && canManage
      ? "doors"
      : params.get("tab") === "status" && canManage
      ? "status"
      : "rules";
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
    <div className="min-w-0 space-y-6">
      {saved && (
        <RuleSaveNotice result={saved} onDismiss={() => setSaved(null)} />
      )}
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value === "status" || value === "doors")
              next.set("tab", value);
            else {
              next.delete("tab");
            }
            return next;
          })
        }
      >
        <TabsList className="h-auto flex flex-nowrap justify-start w-fit max-w-full overflow-x-auto [&>button]:shrink-0 [&>button]:min-h-11 md:[&>button]:min-h-0">
          <TabsTrigger value="rules">Kurallar</TabsTrigger>
          {canManage && <TabsTrigger value="status">Yetki Durumu</TabsTrigger>}
          {canManage && <TabsTrigger value="doors">Kapı Planları</TabsTrigger>}
        </TabsList>
        {canManage && <TabsContent value="doors"><DoorPlansTab /></TabsContent>}
        {canManage && (
          <TabsContent value="status">
            <StatusPage />
          </TabsContent>
        )}
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
