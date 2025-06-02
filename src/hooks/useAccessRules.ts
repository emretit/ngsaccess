
import { useAccessRuleQueries } from './access-rules/useAccessRuleQueries';
import { useAccessRuleMutations } from './access-rules/useAccessRuleMutations';

export const useAccessRules = () => {
  const { rules, isLoading } = useAccessRuleQueries();
  const { createRule, isCreating, toggleRule, isToggling } = useAccessRuleMutations();

  return {
    rules,
    isLoading,
    createRule,
    isCreating,
    toggleRule,
    isToggling
  };
};

// Re-export types for backward compatibility
export type { AccessRuleFormData, AccessRule } from '@/types/access-rule';
