import { useMutation } from "convex/react";
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

  const createAccessRuleWithMembers = {
    mutateAsync: async (params: CreateRuleWithMembersParams) => {
      const result = await createWithGroups({
        ...params.rule,
        employeeIds: params.employeeIds,
        deviceIds: params.deviceIds,
      });
      toast({ title: "Başarılı", description: "Erişim kuralı ve üyeleri oluşturuldu." });
      return result;
    },
    mutate: (params: CreateRuleWithMembersParams) => {
      createWithGroups({
        ...params.rule,
        employeeIds: params.employeeIds,
        deviceIds: params.deviceIds,
      })
        .then(() => toast({ title: "Başarılı", description: "Erişim kuralı ve üyeleri oluşturuldu." }))
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
      return result;
    },
    mutate: (params: UpdateRuleWithMembersParams) => {
      updateWithGroups({
        ruleId: params.id,
        ...params.updates,
        employeeIds: params.employeeIds,
        deviceIds: params.deviceIds,
      })
        .then(() => toast({ title: "Başarılı", description: "Erişim kuralı güncellendi." }))
        .catch(() =>
          toast({ variant: "destructive", title: "Hata", description: "Erişim kuralı güncellenemedi." })
        );
    },
    isPending: false,
  };

  return { createAccessRuleWithMembers, updateAccessRuleWithAdditionalMembers };
};
