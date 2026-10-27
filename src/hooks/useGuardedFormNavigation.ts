import { useCallback, useContext, useEffect } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useProjectChangeGuard } from "@/contexts/ActiveProjectContext";
import { installNavigationGuard } from "@/lib/navigationGuard";

export interface GuardedFormNavigationOptions {
  active?: boolean;
  dirty: boolean;
  pending: boolean;
}

export function guardedFormNavigationDecision({ active = true, dirty, pending }: GuardedFormNavigationOptions) {
  return {
    beforeUnload: active && dirty,
    interceptNavigation: active && (dirty || pending),
    close: !active ? "proceed" : pending ? "block" : dirty ? "confirm" : "proceed",
  } as const;
}

/** Draft ownership/reset stays with the form; dirty determines beforeunload protection. */
export function useGuardedFormNavigation(options: GuardedFormNavigationOptions) {
  const { pending } = options;
  const decision = guardedFormNavigationDecision(options);
  const guard = useUnsavedChangesGuard(decision.beforeUnload);
  const { requestClose: requestUnsavedClose } = guard;
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const requestClose = useCallback((proceed: () => void) => {
    if (decision.close !== "block") requestUnsavedClose(proceed);
  }, [decision.close, requestUnsavedClose]);
  useProjectChangeGuard(decision.interceptNavigation, requestClose);
  useEffect(() => {
    if (!decision.interceptNavigation) return;
    return installNavigationGuard(navigator, requestClose, window, pending);
  }, [decision.interceptNavigation, navigator, requestClose, pending]);
  return { requestClose, dialog: guard.dialog };
}
