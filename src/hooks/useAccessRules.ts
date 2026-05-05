
import { useAccessRulesQuery } from "./access-rules/useAccessRulesQuery";
import { useAccessRuleMutations } from "./access-rules/useAccessRuleMutations";
import { useGroupMemberMutations } from "./access-rules/useGroupMemberMutations";
import { useGroupDeviceMutations } from "./access-rules/useGroupDeviceMutations";
import { useComplexAccessRuleMutations } from "./access-rules/useComplexAccessRuleMutations";
import type { Id } from "../../convex/_generated/dataModel";

export const useAccessRules = (projectId?: Id<"projects">) => {
  const { data: accessRules, isLoading, error } = useAccessRulesQuery(projectId);
  
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
    accessRules,
    rules: accessRules || [], // Legacy alias
    isLoading,
    error,
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
