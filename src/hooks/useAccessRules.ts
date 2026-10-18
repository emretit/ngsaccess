
import { useAccessRuleMutations } from "./access-rules/useAccessRuleMutations";
import { useGroupMemberMutations } from "./access-rules/useGroupMemberMutations";
import { useGroupDeviceMutations } from "./access-rules/useGroupDeviceMutations";
import { useComplexAccessRuleMutations } from "./access-rules/useComplexAccessRuleMutations";
import type { Id } from "../../convex/_generated/dataModel";

export const useAccessRules = (_projectId?: Id<"projects">) => {
  
  const {
    createAccessRule,
    updateAccessRule,
    deleteAccessRule
  } = useAccessRuleMutations();
  
  const {
    addGroupMember,
    removeGroupMember
  } = useGroupMemberMutations();
  
  const {
    addGroupDevice,
    removeGroupDevice
  } = useGroupDeviceMutations();
  
  const {
    createAccessRuleWithMembers,
    updateAccessRuleWithAdditionalMembers
  } = useComplexAccessRuleMutations();

  return {
    createAccessRule,
    createAccessRuleWithMembers,
    createRule: createAccessRule, // Legacy alias
    isCreating: createAccessRule.isPending,
    updateAccessRule,
    updateAccessRuleWithAdditionalMembers,
    updateRule: updateAccessRule, // Legacy alias
    isUpdating: updateAccessRule.isPending || updateAccessRuleWithAdditionalMembers.isPending,
    deleteAccessRule,
    deleteRule: deleteAccessRule, // Legacy alias
    isDeleting: deleteAccessRule.isPending,
    toggleRule: updateAccessRule, // Legacy alias
    isToggling: updateAccessRule.isPending,
    addGroupMember,
    removeGroupMember,
    addGroupDevice,
    removeGroupDevice
  };
};
