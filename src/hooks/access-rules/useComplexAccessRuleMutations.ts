import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { Id } from "../../../convex/_generated/dataModel";

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

export const useComplexAccessRuleMutations = () => {
  const { toast } = useToast();

  const createWithGroups = useMutation(api.accessRules.createWithGroups);
  const updateWithGroups = useMutation(api.accessRules.updateWithGroups);
  const syncWeekPlan = useAction(api.actions.hikvisionSync.syncWeekPlanToDevices);

  const createAccessRuleWithMembers = {
    mutateAsync: async (params: CreateRuleWithMembersParams) => {
      const result = await createWithGroups({
        ...params.rule,
        employeeIds: params.employeeIds,
        deviceIds: params.deviceIds,
      });
      toast({ title: "Başarılı", description: "Erişim kuralı ve üyeleri oluşturuldu." });

      // Hikvision cihazlarına zaman planı + kişileri senkronize et
      try {
        const syncResult = await syncWeekPlan({ accessRuleId: result });
        if (syncResult.synced > 0) {
          toast({ title: "Cihaz Senkronizasyonu", description: `${syncResult.synced} cihaza zaman planı gönderildi, ${syncResult.employeesSynced} kişi senkronize edildi` });
        }
      } catch {
        // Sync hatası kural kaydını engellemez
      }

      return result;
    },
    mutate: (params: CreateRuleWithMembersParams) => {
      createWithGroups({
        ...params.rule,
        employeeIds: params.employeeIds,
        deviceIds: params.deviceIds,
      })
        .then((ruleId) => {
          toast({ title: "Başarılı", description: "Erişim kuralı ve üyeleri oluşturuldu." });
          syncWeekPlan({ accessRuleId: ruleId }).catch(() => {});
        })
        .catch(() =>
          toast({ variant: "destructive", title: "Hata", description: "Erişim kuralı oluşturulamadı." })
        );
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

      // Hikvision cihazlarına zaman planı + kişileri senkronize et
      try {
        const syncResult = await syncWeekPlan({ accessRuleId: params.id });
        if (syncResult.synced > 0) {
          toast({ title: "Cihaz Senkronizasyonu", description: `${syncResult.synced} cihaza zaman planı gönderildi, ${syncResult.employeesSynced} kişi senkronize edildi` });
        }
      } catch {
        // Sync hatası kural kaydını engellemez
      }

      return result;
    },
    mutate: (params: UpdateRuleWithMembersParams) => {
      updateWithGroups({
        ruleId: params.id,
        ...params.updates,
        employeeIds: params.employeeIds,
        deviceIds: params.deviceIds,
      })
        .then(() => {
          toast({ title: "Başarılı", description: "Erişim kuralı güncellendi." });
          syncWeekPlan({ accessRuleId: params.id }).catch(() => {});
        })
        .catch(() =>
          toast({ variant: "destructive", title: "Hata", description: "Erişim kuralı güncellenemedi." })
        );
    },
    isPending: false,
  };

  return { createAccessRuleWithMembers, updateAccessRuleWithAdditionalMembers };
};
