import { useMutation, useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { Id } from "../../../convex/_generated/dataModel";
import { deviceSyncStore } from "./deviceSyncStore";

interface CreateRuleWithMembersParams {
  rule: {
    name: string;
    description?: string;
    targetType: string;
    startTime?: string;
    endTime?: string;
    days: string[];
    accessDirection: string;
    priority: number;
    projectId?: Id<"projects">;
  };
  employeeIds?: Id<"employees">[];
  deviceIds?: Id<"devices">[];
}

interface UpdateRuleWithMembersParams {
  id: Id<"accessRules">;
  updates: {
    name?: string;
    description?: string;
    targetType?: string;
    startTime?: string;
    endTime?: string;
    days?: string[];
    accessDirection?: string;
    priority?: number;
    projectId?: Id<"projects">;
    isActive?: boolean;
  };
  employeeIds?: Id<"employees">[];
  deviceIds?: Id<"devices">[];
}

type SyncResult = FunctionReturnType<typeof api.actions.hikvisionSync.syncWeekPlanToDevices>;

export const useComplexAccessRuleMutations = () => {
  const { toast } = useToast();

  const createWithGroups = useMutation(api.accessRules.createWithGroups);
  const updateWithGroups = useMutation(api.accessRules.updateWithGroups);
  const syncWeekPlan = useAction(api.actions.hikvisionSync.syncWeekPlanToDevices);

  const startBackgroundSync = (ruleId: Id<"accessRules">) => {
    const finish = deviceSyncStore.start();
    void syncWeekPlan({ accessRuleId: ruleId })
      .then((syncResult: SyncResult) => {
        if (syncResult.synced > 0) {
          toast({
            title: "Cihaz Senkronizasyonu",
            description: `${syncResult.synced} cihaza zaman planı gönderildi, ${syncResult.employeesSynced} kişi senkronize edildi`,
          });
        }
        if (syncResult.failed > 0) {
          toast({
            variant: "destructive",
            title: "Cihaz Senkronizasyonu",
            description: `${syncResult.failed} cihaza gönderilemedi`,
          });
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Bilinmeyen hata";
        toast({
          variant: "destructive",
          title: "Cihaz senkronizasyon hatası",
          description: message,
        });
      })
      .finally(finish);
  };

  const createAccessRuleWithMembers = {
    mutateAsync: async (params: CreateRuleWithMembersParams) => {
      const result = await createWithGroups({
        ...params.rule,
        employeeIds: params.employeeIds,
        deviceIds: params.deviceIds,
      });
      toast({ title: "Başarılı", description: "Erişim kuralı ve üyeleri oluşturuldu." });
      startBackgroundSync(result);
      return result;
    },
    isPending: false,
  };

  const updateAccessRuleWithAdditionalMembers = {
    mutateAsync: async (params: UpdateRuleWithMembersParams) => {
      const result = await updateWithGroups({
        ruleId: params.id,
        ...params.updates,
        employeeIds: params.employeeIds,
        deviceIds: params.deviceIds,
      });
      toast({ title: "Başarılı", description: "Erişim kuralı güncellendi." });
      startBackgroundSync(params.id);
      return result;
    },
    isPending: false,
  };

  return { createAccessRuleWithMembers, updateAccessRuleWithAdditionalMembers };
};
