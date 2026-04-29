import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { Id } from "../../../convex/_generated/dataModel";

interface CreateRuleInput {
  name: string;
  description?: string;
  targetType: string;
  startTime?: string;
  endTime?: string;
  days: string[];
  accessDirection: string;
  priority: number;
  projectId?: Id<"projects">;
  isActive?: boolean;
}

export const useAccessRuleMutations = () => {
  const { toast } = useToast();

  const createRule = useMutation(api.accessRules.create);
  const updateRule = useMutation(api.accessRules.update);
  const deleteRule = useMutation(api.accessRules.remove);

  const createAccessRule = {
    mutateAsync: async (input: CreateRuleInput) => {
      const result = await createRule({
        name: input.name,
        description: input.description,
        targetType: input.targetType,
        startTime: input.startTime,
        endTime: input.endTime,
        days: input.days,
        accessDirection: input.accessDirection,
        priority: input.priority,
        projectId: input.projectId,
        isActive: true,
      });
      toast({ title: "Başarılı", description: "Erişim kuralı oluşturuldu." });
      return result;
    },
    mutate: (input: CreateRuleInput) => {
      createRule({
        name: input.name,
        description: input.description,
        targetType: input.targetType,
        startTime: input.startTime,
        endTime: input.endTime,
        days: input.days,
        accessDirection: input.accessDirection,
        priority: input.priority,
        projectId: input.projectId,
        isActive: true,
      })
        .then(() => toast({ title: "Başarılı", description: "Erişim kuralı oluşturuldu." }))
        .catch(() =>
          toast({ variant: "destructive", title: "Hata", description: "Erişim kuralı oluşturulamadı." })
        );
    },
    isPending: false,
  };

  const updateAccessRule = {
    mutateAsync: async ({ id, updates }: { id: Id<"accessRules">; updates: Partial<CreateRuleInput> }) => {
      const result = await updateRule({ ruleId: id, ...updates });
      toast({ title: "Başarılı", description: "Erişim kuralı güncellendi." });
      return result;
    },
    mutate: ({ id, updates }: { id: Id<"accessRules">; updates: Partial<CreateRuleInput> }) => {
      updateRule({ ruleId: id, ...updates })
        .then(() => toast({ title: "Başarılı", description: "Erişim kuralı güncellendi." }))
        .catch(() =>
          toast({ variant: "destructive", title: "Hata", description: "Erişim kuralı güncellenemedi." })
        );
    },
    isPending: false,
  };

  const deleteAccessRule = {
    mutateAsync: async (id: Id<"accessRules">) => {
      await deleteRule({ ruleId: id });
      toast({ title: "Başarılı", description: "Erişim kuralı silindi." });
    },
    mutate: (id: Id<"accessRules">) => {
      deleteRule({ ruleId: id })
        .then(() => toast({ title: "Başarılı", description: "Erişim kuralı silindi." }))
        .catch(() =>
          toast({ variant: "destructive", title: "Hata", description: "Erişim kuralı silinemedi." })
        );
    },
    isPending: false,
  };

  return { createAccessRule, updateAccessRule, deleteAccessRule };
};
