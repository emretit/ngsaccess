
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

  // Legacy API compatibility - aliasing new names to old ones
  const rules = accessRules || [];
  const createRule = createAccessRule;
  const isCreating = createAccessRule.isPending;
  const updateRule = updateAccessRule;
  const isUpdating = updateAccessRule.isPending || updateAccessRuleWithAdditionalMembers.isPending;
  const deleteRule = deleteAccessRule;
  const isDeleting = deleteAccessRule.isPending;
  const toggleRule = updateAccessRule;
  const isToggling = updateAccessRule.isPending;

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
