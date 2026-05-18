
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAccessRules } from "@/hooks/useAccessRules";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Users, Monitor, ChevronDown, ChevronUp, Edit, Trash2, Clock, Calendar, UploadCloud, Shield } from "lucide-react";
import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLocationUtils } from "@/hooks/useLocationUtils";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useDeviceSyncing, deviceSyncStore } from "@/hooks/access-rules/deviceSyncStore";
import { formatWeekdaysAbbr } from "./components/weekdays";
import type { AccessRule, GroupMember, GroupDevice } from "@/types/access-control";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AccessRulesListProps {
  onCreateRule: () => void;
  onEditRule?: (rule: AccessRule) => void;
}

const AccessRulesList = ({ onCreateRule, onEditRule }: AccessRulesListProps) => {
  const { rules, isLoading, error, updateAccessRule, deleteAccessRule, isDeleting } = useAccessRules();
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [optimisticActive, setOptimisticActive] = useState<Map<string, boolean>>(new Map());
  const { getDeviceLocationDisplay } = useLocationUtils();
  const { projectId } = useActiveProject();
  const currentProjectId = projectId ?? null;
  const backfillRules = useAction(api.actions.hikvisionSync.backfillAllRulesToDevices);
  const isDeviceSyncing = useDeviceSyncing();

  const handleBackfill = async () => {
    if (!currentProjectId) {
      toast({
        title: "Proje seçilmedi",
        description: "Önce bir proje seçin.",
        variant: "destructive",
      });
      return;
    }
    const finish = deviceSyncStore.start();
    try {
      const res = await backfillRules({ projectId: currentProjectId });
      toast({
        title: "Cihazlara push tamam",
        description: `${res.rulesProcessed} kural · ${res.synced} başarılı · ${res.failed} hata`,
      });
    } catch (e) {
      toast({
        title: "Push başarısız",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      finish();
    }
  };

  const handleToggleActive = async (rule: AccessRule, next: boolean) => {
    const ruleId = String(rule._id);
    setOptimisticActive((prev) => new Map(prev).set(ruleId, next));
    try {
      await updateAccessRule.mutateAsync({ id: rule._id, updates: { isActive: next } });
    } catch (error) {
      setOptimisticActive((prev) => {
        const m = new Map(prev);
        m.delete(ruleId);
        return m;
      });
      const message = error instanceof Error ? error.message : "Kural durumu değiştirilemedi";
      toast({ title: "Hata", description: message, variant: "destructive" });
    } finally {
      setOptimisticActive((prev) => {
        if (!prev.has(ruleId)) return prev;
        const m = new Map(prev);
        m.delete(ruleId);
        return m;
      });
    }
  };

  const toggleExpanded = (ruleId: string) => {
    setExpandedRules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    deleteAccessRule.mutate(ruleId as AccessRule["_id"]);
  };

  const handleEditRule = (rule: AccessRule) => {
    if (onEditRule) {
      onEditRule(rule);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">&#x26a0;&#xfe0f;</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Hata Oluştu
        </h3>
        <p className="text-muted-foreground mb-4">
          Erişim kuralları yüklenirken bir hata oluştu: {String(error)}
        </p>
        <Button onClick={() => window.location.reload()}>
          Yeniden Dene
        </Button>
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">&#x1f510;</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Henüz erişim kuralı yok
        </h3>
        <p className="text-muted-foreground mb-4">
          İlk erişim kuralınızı oluşturmak için başlayın.
        </p>
        <Button onClick={onCreateRule}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Kural
        </Button>
      </div>
    );
  }


  const renderEmployees = (rule: AccessRule) => {
    const employees = rule.groupMembers?.map((gm: GroupMember) => gm.employees).filter(Boolean) ?? [];

    if (employees.length === 0) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span className="text-sm">Çalışan seçilmemiş</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-blue-500" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{employees.length} çalışan</span>
          <span className="text-xs text-muted-foreground">
            {employees.slice(0, 2).map((emp) => `${emp?.firstName ?? ''} ${emp?.lastName ?? ''}`).join(', ')}
            {employees.length > 2 && ` +${employees.length - 2} diğer`}
          </span>
        </div>
      </div>
    );
  };

  const renderDevices = (rule: AccessRule) => {
    const devices = rule.groupDevices?.map((gd: GroupDevice) => gd.devices).filter(Boolean) ?? [];

    if (devices.length === 0) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Monitor className="h-4 w-4" />
          <span className="text-sm">Cihaz seçilmemiş</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-green-500" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{devices.length} cihaz</span>
          <span className="text-xs text-muted-foreground">
            {devices.slice(0, 2).map((device) => device?.name ?? '').join(', ')}
            {devices.length > 2 && ` +${devices.length - 2} diğer`}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card shadow-xs p-4 md:p-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 mr-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight">Erişim Kuralları</h2>
              <p className="text-xs text-muted-foreground">
                {(rules as AccessRule[]).length} kural tanımlı
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackfill}
              disabled={isDeviceSyncing || !currentProjectId}
              className="h-8 gap-1.5 text-xs"
              title={
                !currentProjectId
                  ? "Önce bir proje seçin"
                  : isDeviceSyncing
                  ? "Cihaz senkronizasyonu devam ediyor..."
                  : "Aktif projedeki tüm kuralları Hikvision cihazlara push eder"
              }
            >
              {isDeviceSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UploadCloud className="h-3.5 w-3.5" />
              )}
              {isDeviceSyncing ? "Senkronize ediliyor..." : "Cihazlara Push Et"}
            </Button>
            <Button onClick={onCreateRule} size="sm" className="h-8 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Yeni Kural
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {(rules as AccessRule[]).map((rule) => {
          const ruleId = String(rule._id);
          return (
            <Card key={ruleId} className="border border-border hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{rule.name}</h3>
                      {(() => {
                        const effectiveActive = optimisticActive.get(String(rule._id)) ?? rule.isActive ?? true;
                        return (
                          <Badge variant={effectiveActive ? "default" : "secondary"}>
                            {effectiveActive ? "Aktif" : "Pasif"}
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={optimisticActive.get(String(rule._id)) ?? rule.isActive ?? true}
                      onCheckedChange={(checked) => handleToggleActive(rule, checked)}
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditRule(rule)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Kuralı Sil</AlertDialogTitle>
                          <AlertDialogDescription>
                            Bu erişim kuralını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>İptal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteRule(ruleId)}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Siliniyor...
                              </>
                            ) : (
                              'Sil'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(ruleId)}
                          className="h-8 w-8 p-0"
                        >
                          {expandedRules.has(ruleId) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </Collapsible>
                  </div>
                </div>

                {rule.description && (
                  <p className="text-sm text-muted-foreground mt-2">{rule.description}</p>
                )}
              </CardHeader>

              <CardContent className="pt-0">
                {/* Quick Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <div>
                      <span className="text-sm font-medium">Zaman</span>
                      <p className="text-xs text-muted-foreground">
                        {rule.startTime && rule.endTime
                          ? `${rule.startTime} - ${rule.endTime}`
                          : '24 saat'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <div>
                      <span className="text-sm font-medium">Günler</span>
                      <p className="text-xs text-muted-foreground">
                        {formatWeekdaysAbbr(rule.days || [])}
                      </p>
                    </div>
                  </div>

                  <div>{renderEmployees(rule)}</div>
                  <div>{renderDevices(rule)}</div>
                </div>

                {/* Expandable Details */}
                <Collapsible open={expandedRules.has(ruleId)}>
                  <CollapsibleContent>
                    <div className="border-t border-border pt-4 mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3">Çalışanlar</h4>
                          <div className="space-y-2">
                            {rule.groupMembers && rule.groupMembers.length > 0 ? (
                              rule.groupMembers.map((gm: GroupMember) => (
                                <div key={gm._id} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                                  <Users className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm">{gm.employees?.firstName} {gm.employees?.lastName}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-muted-foreground italic">Çalışan seçilmemiş</div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3">Cihazlar</h4>
                          <div className="space-y-2">
                            {rule.groupDevices && rule.groupDevices.length > 0 ? (
                              rule.groupDevices.map((gd: GroupDevice) => (
                                <div key={gd._id} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                                  <Monitor className="h-4 w-4 text-green-500" />
                                  <div>
                                    <span className="text-sm font-medium">{gd.devices?.name}</span>
                                    <p className="text-xs text-muted-foreground">
                                      {gd.devices ? getDeviceLocationDisplay({
                                        zoneId: gd.devices.zoneId,
                                        doorId: gd.devices.doorId,
                                      }) : 'Konum Bilinmiyor'}
                                    </p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-muted-foreground italic">Cihaz seçilmemiş</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AccessRulesList;
