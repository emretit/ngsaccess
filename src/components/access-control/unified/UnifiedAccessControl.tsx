import { PageHeaderPrimaryButton } from "@/components/shared/PageHeader";
import { PageTemplate } from "@/components/shared/PageTemplate";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { Button } from "@/components/ui/button";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { AccessControlHeaderContext, type AccessControlHeaderAction } from "./hooks/useAccessControlHeader";
import { DoorPlansTab } from "../door-plans/DoorPlansTab";
import { usePermissions } from "@/hooks/usePermissions";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StatusPage from "./status/StatusPage";
import { useState } from "react";
import AccessRulesList from "./AccessRulesList";
import CreateRuleDialog from "./CreateRuleDialog";
import { RuleSaveNotice, ProjectSyncButton } from "./SyncRuns";
import type { RuleSaveResult } from "@/hooks/access-rules/useComplexAccessRuleMutations";
import type { AccessRule } from "@/types/access-control";

const ProjectAccessControl = () => {
  const { projectId, activeProject } = useActiveProject();
  const [headerAction, setHeaderAction] = useState<AccessControlHeaderAction>();
  const descriptions = {
    rules: "Kişilerin hangi kapılardan hangi gün ve saatlerde geçebileceği",
    status: "Kişi yetkilerinin cihazlara ulaşıp ulaşmadığı",
    doors: "Kapıların herkes için sürekli açık ya da kilitli kalacağı saatler",
  };
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
    <AccessControlHeaderContext.Provider value={setHeaderAction}>
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
      <PageTemplate title="Geçiş Kontrol" scope={`${activeProject?.name ?? "Proje seçin"} · ${descriptions[tab]}`}
        primaryAction={tab === "rules" && canManage && projectId ? <PageHeaderPrimaryButton onClick={handleCreateRule}>Yeni kural</PageHeaderPrimaryButton> : undefined}
        secondaryActions={<>
          {tab === "rules" && canManage && projectId && <QuerySectionBoundary resetKey={projectId}><ProjectSyncButton projectId={projectId} /></QuerySectionBoundary>}
          {tab === "status" && headerAction && <Button variant="outline" className="min-h-11 md:min-h-9" disabled={headerAction.disabled} onClick={headerAction.onClick}>{headerAction.label}</Button>}
        </>}
        notice={saved && <RuleSaveNotice result={saved} onDismiss={() => setSaved(null)} />}
        overlays={isCreateDialogOpen && (
        <QuerySectionBoundary resetKey={projectId} title="Kural formu yüklenemedi"><CreateRuleDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          editingRule={editingRule}
          onClose={handleCloseDialog}
          onDiffSaved={setSaved}
        /></QuerySectionBoundary>
      )}
        navigation={
        <TabsList className="h-auto flex flex-nowrap justify-start w-fit max-w-full overflow-x-auto [&>button]:shrink-0 [&>button]:min-h-11 md:[&>button]:min-h-0">
          <TabsTrigger value="rules">Kurallar</TabsTrigger>
          {canManage && <TabsTrigger value="status">Yetki Durumu</TabsTrigger>}
          {canManage && <TabsTrigger value="doors">Kapı Planları</TabsTrigger>}
        </TabsList>
        }>
        {canManage && <TabsContent value="doors"><QuerySectionBoundary resetKey={projectId} title="Kapı planları yüklenemedi"><DoorPlansTab /></QuerySectionBoundary></TabsContent>}
        {canManage && (
          <TabsContent value="status">
            <QuerySectionBoundary resetKey={projectId} title="Yetki durumu yüklenemedi"><StatusPage /></QuerySectionBoundary>
          </TabsContent>
        )}
        <TabsContent value="rules">
          <QuerySectionBoundary resetKey={projectId} title="Geçiş kuralları yüklenemedi"><AccessRulesList
            onCreateRule={handleCreateRule}
            onEditRule={handleEditRule}
          /></QuerySectionBoundary>
        </TabsContent>


      </PageTemplate>
      </Tabs>
    </AccessControlHeaderContext.Provider>
  );
};

const UnifiedAccessControl = () => {
  return <ProjectAccessControl />;
};

export default UnifiedAccessControl;
