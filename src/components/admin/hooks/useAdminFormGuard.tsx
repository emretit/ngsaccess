import { useGuardedFormNavigation } from "@/hooks/useGuardedFormNavigation";

/** All mounted admin forms protect route, tab, browser-back and project changes. */
export function useAdminFormGuard(
  _id: string,
  dirty: boolean,
  pending: boolean,
) {
  return useGuardedFormNavigation({ dirty: dirty || pending, pending });
}
