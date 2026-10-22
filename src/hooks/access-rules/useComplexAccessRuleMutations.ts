import type { FunctionArgs } from "convex/server";
import { useRef, useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { notify } from "@/lib/notify";
import { Id } from "../../../convex/_generated/dataModel";

interface CreateRuleWithMembersParams {
  rule: {
    scheduleTemplateId?: Id<"accessScheduleTemplates"> | null;
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
    scheduleTemplateId?: Id<"accessScheduleTemplates"> | null;
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
  relationDiff?: FunctionArgs<typeof api.accessRules.updateWithGroups>["relationDiff"];
  employeeIds?: Id<"employees">[];
  deviceIds?: Id<"devices">[];
  doorIds?: Id<"doors">[];
}

export type RuleSaveResult = { ruleId: Id<"accessRules">; runId: Id<"deviceSyncRuns"> | null };
export const useComplexAccessRuleMutations = (onDiffSaved?: (result: RuleSaveResult) => void) => {
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
  const updateWithGroupsTracked = useMutation(api.accessRules.updateWithGroupsTracked);
  const startRuleSync = useAction(api.deviceSyncRuns.startRuleSync);
  const startBackgroundSync = (ruleId: Id<"accessRules">) => {
    void startRuleSync({ ruleId })
      .then(() => {
        notify.info(
          "Cihaz gönderimi başlatıldı",
          "Sonucu Son gönderimler bölümünden izleyebilirsiniz.",
        );
      })
      .catch((error: unknown) => {
        notify.error("Kural kaydedildi; cihaz gönderimi başlatılamadı", error);
      });
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
        const payload = {
          ruleId: params.id,
          ...params.updates,
          relationDiff: params.relationDiff,
          employeeIds: params.employeeIds,
          deviceIds: params.deviceIds,
          doorIds: params.doorIds,
        };
        if (params.relationDiff) {
          const result = await updateWithGroupsTracked(payload);
          notify.success("Kural kaydedildi", result.runId
            ? "Gönderim sonucunu aç bağlantısından cihaz durumlarını izleyebilirsiniz."
            : "Değişiklik yok. Yeniden denemek için Cihazlara gönder seçeneğini kullanın.");
          onDiffSaved?.(result);
          return result.ruleId;
        }
        const result = await updateWithGroups(payload);
        notify.success("Kural kaydedildi", "Cihaz işlemleri ayrıca izlenir.");
        startBackgroundSync(params.id);
        return result;
      }),
    isPending: [...pending].some((key) => key !== "create"),
  };

  return { createAccessRuleWithMembers, updateAccessRuleWithAdditionalMembers };
};
