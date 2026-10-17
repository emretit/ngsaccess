import { useRef, useState } from "react";
import { useMutation, useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { notify } from "@/lib/notify";
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
    startTime?: string | null;
    endTime?: string | null;
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

type SyncResult = FunctionReturnType<
  typeof api.actions.hikvisionSync.syncWeekPlanToDevices
>;
type IdeSyncResult = FunctionReturnType<
  typeof api.actions.ideGatewayDevice.syncRuleToIdePanelsAndWait
>;

export const useComplexAccessRuleMutations = () => {
  const pendingRef = useRef(new Set<string>());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const runPending = async <T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    if (pendingRef.current.has(key))
      throw new Error("İşlem zaten devam ediyor.");
    pendingRef.current.add(key);
    setPending(new Set(pendingRef.current));
    try {
      return await operation();
    } finally {
      pendingRef.current.delete(key);
      setPending(new Set(pendingRef.current));
    }
  };

  const createWithGroups = useMutation(api.accessRules.createWithGroups);
  const updateWithGroups = useMutation(api.accessRules.updateWithGroups);
  const syncWeekPlan = useAction(
    api.actions.hikvisionSync.syncWeekPlanToDevices,
  );
  const syncIdeRule = useAction(
    api.actions.ideGatewayDevice.syncRuleToIdePanelsAndWait,
  );

  const startBackgroundSync = (ruleId: Id<"accessRules">) => {
    const finish = deviceSyncStore.start();

    // Hikvision: senkron sonuç → toast.
    const hik = syncWeekPlan({ accessRuleId: ruleId })
      .then((syncResult: SyncResult) => {
        if (syncResult.synced > 0) {
          notify.success(
            "Cihaz Senkronizasyonu",
            `${syncResult.synced} cihaz için plan işi başlatıldı, ${syncResult.employeesSynced} kişi kuyruğa alındı`,
          );
        }
        if (syncResult.failed > 0) {
          notify.error(
            "Cihaz Senkronizasyonu",
            `${syncResult.failed} cihaza gönderilemedi`,
          );
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Bilinmeyen hata";
        notify.error("Cihaz senkronizasyon hatası", message);
      });

    // IDE Smart: op'lar kuyruğa atılır, panel ack'i beklenir → toast (Hikvision paritesi).
    const ide = syncIdeRule({ accessRuleId: ruleId })
      .then((r: IdeSyncResult) => {
        // Gerçekten IDE paneli yoksa (op yok + atlanan yok) sessiz kal.
        if (r.queued === 0 && r.skipped.length === 0) return;
        if (r.queued > 0) {
          if (r.failed > 0) {
            // Kısmi başarıyı da göster (Hikvision'ın çift-toast'ına denk bilgi).
            notify.error(
              "IDE Panel Senkronizasyonu",
              `${r.acked}/${r.queued} panele yazıldı, ${r.failed} başarısız${r.errors[0] ? `: ${friendlySyncError(r.errors[0])}` : ""}`,
            );
          } else if (r.pending > 0) {
            notify.info(
              "IDE Panel Senkronizasyonu",
              `${r.acked}/${r.queued} panele yazıldı, ${r.pending} işlem panel yanıtını bekliyor`,
            );
          } else {
            notify.success(
              "IDE Panel Senkronizasyonu",
              `${r.acked} işlem panele yazıldı`,
            );
          }
        }
        if (r.skipped.length > 0) {
          notify.error("IDE Panel uyarısı", r.skipped.join("; "));
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Bilinmeyen hata";
        notify.error("IDE senkronizasyon hatası", message);
      });

    void Promise.allSettled([hik, ide]).finally(finish);
  };

  const createAccessRuleWithMembers = {
    mutateAsync: (params: CreateRuleWithMembersParams) =>
      runPending("create", async () => {
        const result = await createWithGroups({
          ...params.rule,
          employeeIds: params.employeeIds,
          deviceIds: params.deviceIds,
          doorIds: params.doorIds,
        });
        notify.success("Başarılı", "Erişim kuralı ve üyeleri oluşturuldu.");
        startBackgroundSync(result);
        return result;
      }),
    isPending: pending.has("create"),
  };

  const updateAccessRuleWithAdditionalMembers = {
    mutateAsync: (params: UpdateRuleWithMembersParams) =>
      runPending(params.id, async () => {
        const result = await updateWithGroups({
          ruleId: params.id,
          ...params.updates,
          employeeIds: params.employeeIds,
          deviceIds: params.deviceIds,
          doorIds: params.doorIds,
        });
        notify.success("Başarılı", "Erişim kuralı güncellendi.");
        startBackgroundSync(params.id);
        return result;
      }),
    isPending: [...pending].some((key) => key !== "create"),
  };

  return { createAccessRuleWithMembers, updateAccessRuleWithAdditionalMembers };
};
