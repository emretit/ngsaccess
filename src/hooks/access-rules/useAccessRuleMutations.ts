import { useRef, useState } from "react";
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
  const pendingRef = useRef(new Map<string, "create" | "update" | "delete">());
  const [pending, setPending] = useState(new Map<string, "create" | "update" | "delete">());
  const runPending = async <T,>(key: string, kind: "create" | "update" | "delete", operation: () => Promise<T>): Promise<T> => {
    if (pendingRef.current.has(key)) throw new Error("Bu kural için işlem zaten devam ediyor.");
    pendingRef.current.set(key, kind);
    setPending(new Map(pendingRef.current));
    try {
      return await operation();
    } finally {
      pendingRef.current.delete(key);
      setPending(new Map(pendingRef.current));
    }
  };

  const createRule = useMutation(api.accessRules.create);
  const updateRule = useMutation(api.accessRules.update);
  const deleteRule = useMutation(api.accessRules.remove);

  const createAccessRule = {
    mutateAsync: (input: CreateRuleInput) => runPending("create", "create", async () => {
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
    }),
    mutate: (input: CreateRuleInput) => {
      void createAccessRule.mutateAsync(input).catch(() =>
        toast({ variant: "destructive", title: "Hata", description: "Erişim kuralı oluşturulamadı." })
      );
    },
    isPending: [...pending.values()].includes("create"),
    isPendingFor: (id: Id<"accessRules">) => pending.has(id),
  };

  const updateAccessRule = {
    mutateAsync: ({ id, updates }: { id: Id<"accessRules">; updates: Partial<CreateRuleInput> }) => runPending(id, "update", async () => {
      const result = await updateRule({ ruleId: id, ...updates });
      toast({ title: "Başarılı", description: "Erişim kuralı güncellendi." });
      return result;
    }),
    mutate: ({ id, updates }: { id: Id<"accessRules">; updates: Partial<CreateRuleInput> }) => {
      void updateAccessRule.mutateAsync({ id, updates }).catch(() =>
        toast({ variant: "destructive", title: "Hata", description: "Erişim kuralı güncellenemedi." })
      );
    },
    isPending: [...pending.values()].includes("update"),
    isPendingFor: (id: Id<"accessRules">) => pending.has(id),
  };

  const deleteAccessRule = {
    mutateAsync: (id: Id<"accessRules">) => runPending(id, "delete", async () => {
      await deleteRule({ ruleId: id });
      toast({ title: "Başarılı", description: "Erişim kuralı silindi." });
    }),
    mutate: (id: Id<"accessRules">) => {
      void deleteAccessRule.mutateAsync(id).catch(() =>
        toast({ variant: "destructive", title: "Hata", description: "Erişim kuralı silinemedi." })
      );
    },
    isPending: [...pending.values()].includes("delete"),
    isPendingFor: (id: Id<"accessRules">) => pending.has(id),
  };

  return { createAccessRule, updateAccessRule, deleteAccessRule };
};
