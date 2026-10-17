import { useRef, useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { notify } from "@/lib/notify";
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
  const startRuleSync = useAction(api.deviceSyncRuns.startRuleSync);
  const startBackgroundSync = (ruleId: Id<"accessRules">) => {
    const finish = deviceSyncStore.start();
    void startRuleSync({ ruleId })
      .then(() => {
        notify.info(
          "Cihaz gönderimi başlatıldı",
          "Sonucu Son gönderimler bölümünden izleyebilirsiniz.",
        );
      })
      .catch((error: unknown) => {
        notify.error("Kural kaydedildi; cihaz gönderimi başlatılamadı", error);
      })
      .finally(finish);
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
        notify.success("Kural kaydedildi", "Cihaz işlemleri ayrıca izlenir.");
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
        notify.success("Kural kaydedildi", "Cihaz işlemleri ayrıca izlenir.");
        startBackgroundSync(params.id);
        return result;
      }),
    isPending: [...pending].some((key) => key !== "create"),
  };

  return { createAccessRuleWithMembers, updateAccessRuleWithAdditionalMembers };
};
