import { useContext, useEffect } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useProjectChangeGuard } from "@/contexts/ActiveProjectContext";
import { installNavigationGuard } from "@/lib/navigationGuard";

/** All mounted admin forms protect route, tab, browser-back and project changes. */
export function useAdminFormGuard(
  _id: string,
  dirty: boolean,
  pending: boolean,
) {
  const guard = useUnsavedChangesGuard(dirty || pending);
  const { requestClose } = guard;
  const { navigator } = useContext(UNSAFE_NavigationContext);
  useProjectChangeGuard(
    dirty || pending,
    pending ? () => undefined : requestClose,
  );
  useEffect(() => {
    if (!dirty && !pending) return;
    return installNavigationGuard(navigator, (proceed) => {
      if (!pending) requestClose(proceed);
    }, window, pending);
  }, [dirty, pending, navigator, requestClose]);
  return guard;
}
