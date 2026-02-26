import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { Id } from "../../../convex/_generated/dataModel";

export const useGroupMemberMutations = () => {
  const { toast } = useToast();

  const addGroupMemberMut = useMutation(api.accessRules.addGroupMember);
  const removeGroupMemberMut = useMutation(api.accessRules.removeGroupMember);

  const addGroupMember = {
    mutateAsync: async ({
      groupId,
      employeeId,
      projectId,
    }: {
      groupId: Id<"accessRules">;
      employeeId: Id<"employees">;
      projectId?: Id<"projects">;
    }) => {
      const result = await addGroupMemberMut({ groupId, employeeId, projectId });
      toast({ title: "Başarılı", description: "Çalışan gruba eklendi." });
      return result;
    },
    mutate: (args: { groupId: Id<"accessRules">; employeeId: Id<"employees">; projectId?: Id<"projects"> }) => {
      addGroupMemberMut(args)
        .then(() => toast({ title: "Başarılı", description: "Çalışan gruba eklendi." }))
        .catch(() =>
          toast({ variant: "destructive", title: "Hata", description: "Çalışan gruba eklenemedi." })
        );
    },
    isPending: false,
  };

  const removeGroupMember = {
    mutateAsync: async (memberId: Id<"groupMembers">) => {
      await removeGroupMemberMut({ memberId });
      toast({ title: "Başarılı", description: "Çalışan gruptan çıkarıldı." });
    },
    mutate: (memberId: Id<"groupMembers">) => {
      removeGroupMemberMut({ memberId })
        .then(() => toast({ title: "Başarılı", description: "Çalışan gruptan çıkarıldı." }))
        .catch(() =>
          toast({ variant: "destructive", title: "Hata", description: "Çalışan gruptan çıkarılamadı." })
        );
    },
    isPending: false,
  };

  return { addGroupMember, removeGroupMember };
};
