import { useCallback, useContext, useEffect, useRef } from "react";
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
  const installed = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    if (!decision.interceptNavigation) return;
    const cleanup = installNavigationGuard(navigator, requestClose, window, pending);
    installed.current = cleanup;
    return () => {
      cleanup();
      if (installed.current === cleanup) installed.current = undefined;
    };
  }, [decision.interceptNavigation, navigator, requestClose, pending]);
  /** Drops route protection synchronously, for a confirmed exit that navigates before the form unmounts. */
  const release = useCallback(() => {
    installed.current?.();
    installed.current = undefined;
  }, []);
  return { requestClose, release, dialog: guard.dialog };
}
