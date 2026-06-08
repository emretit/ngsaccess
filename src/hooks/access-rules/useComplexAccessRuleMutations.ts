import { useMutation, useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { Id } from "../../../convex/_generated/dataModel";
import { deviceSyncStore } from "./deviceSyncStore";
import { friendlySyncError } from "@/lib/syncErrorMessages";

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
  doorIds?: Id<"doors">[];
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
  doorIds?: Id<"doors">[];
}

type SyncResult = FunctionReturnType<typeof api.actions.hikvisionSync.syncWeekPlanToDevices>;
type IdeSyncResult = FunctionReturnType<
  typeof api.actions.ideGatewayDevice.syncRuleToIdePanelsAndWait
>;

export const useComplexAccessRuleMutations = () => {
  const { toast } = useToast();

  const createWithGroups = useMutation(api.accessRules.createWithGroups);
  const updateWithGroups = useMutation(api.accessRules.updateWithGroups);
  const syncWeekPlan = useAction(api.actions.hikvisionSync.syncWeekPlanToDevices);
  const syncIdeRule = useAction(api.actions.ideGatewayDevice.syncRuleToIdePanelsAndWait);

  const startBackgroundSync = (ruleId: Id<"accessRules">) => {
    const finish = deviceSyncStore.start();

    // Hikvision: senkron sonuç → toast.
    const hik = syncWeekPlan({ accessRuleId: ruleId })
      .then((syncResult: SyncResult) => {
        if (syncResult.synced > 0) {
          toast({
            variant: "success",
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
      });

    // IDE Smart: op'lar kuyruğa atılır, panel ack'i beklenir → toast (Hikvision paritesi).
    const ide = syncIdeRule({ accessRuleId: ruleId })
      .then((r: IdeSyncResult) => {
        // Gerçekten IDE paneli yoksa (op yok + atlanan yok) sessiz kal.
        if (r.queued === 0 && r.skipped.length === 0) return;
        if (r.queued > 0) {
          if (r.failed > 0) {
            // Kısmi başarıyı da göster (Hikvision'ın çift-toast'ına denk bilgi).
            toast({
              variant: "destructive",
              title: "IDE Panel Senkronizasyonu",
              description: `${r.acked}/${r.queued} panele yazıldı, ${r.failed} başarısız${r.errors[0] ? `: ${friendlySyncError(r.errors[0])}` : ""}`,
            });
          } else if (r.pending > 0) {
            toast({
              title: "IDE Panel Senkronizasyonu",
              description: `${r.acked}/${r.queued} panele yazıldı, ${r.pending} işlem panel yanıtını bekliyor`,
            });
          } else {
            toast({
              variant: "success",
              title: "IDE Panel Senkronizasyonu",
              description: `${r.acked} işlem panele yazıldı`,
            });
          }
        }
        if (r.skipped.length > 0) {
          toast({
            variant: "destructive",
            title: "IDE Panel uyarısı",
            description: r.skipped.join("; "),
          });
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Bilinmeyen hata";
        toast({
          variant: "destructive",
          title: "IDE senkronizasyon hatası",
          description: message,
        });
      });

    void Promise.allSettled([hik, ide]).finally(finish);
  };

  const createAccessRuleWithMembers = {
    mutateAsync: async (params: CreateRuleWithMembersParams) => {
      const result = await createWithGroups({
        ...params.rule,
        employeeIds: params.employeeIds,
        deviceIds: params.deviceIds,
        doorIds: params.doorIds,
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
        doorIds: params.doorIds,
      });
      toast({ title: "Başarılı", description: "Erişim kuralı güncellendi." });
      startBackgroundSync(params.id);
      return result;
    },
    isPending: false,
  };

  return { createAccessRuleWithMembers, updateAccessRuleWithAdditionalMembers };
};
