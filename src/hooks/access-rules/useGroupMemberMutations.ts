import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { notify } from "@/lib/notify";
import { Id } from "../../../convex/_generated/dataModel";

export const useGroupMemberMutations = () => {

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
      notify.success("Başarılı", "Çalışan gruba eklendi.");
      return result;
    },
    mutate: (args: { groupId: Id<"accessRules">; employeeId: Id<"employees">; projectId?: Id<"projects"> }) => {
      addGroupMemberMut(args)
        .then(() => notify.success("Başarılı", "Çalışan gruba eklendi."))
        .catch(() =>
          notify.error("Hata", "Çalışan gruba eklenemedi.")
        );
    },
    isPending: false,
  };

  const removeGroupMember = {
    mutateAsync: async (memberId: Id<"groupMembers">) => {
      await removeGroupMemberMut({ memberId });
      notify.success("Başarılı", "Çalışan gruptan çıkarıldı.");
    },
    mutate: (memberId: Id<"groupMembers">) => {
      removeGroupMemberMut({ memberId })
        .then(() => notify.success("Başarılı", "Çalışan gruptan çıkarıldı."))
        .catch(() =>
          notify.error("Hata", "Çalışan gruptan çıkarılamadı.")
        );
    },
    isPending: false,
  };

  return { addGroupMember, removeGroupMember };
};
