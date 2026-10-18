import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
export type AdminPrimaryAction = { label: string; onClick: () => void };
export const AdminPrimaryActionContext = createContext<Dispatch<
  SetStateAction<AdminPrimaryAction | undefined>
> | null>(null);

/** Admin places the panel action in PageHeader; Settings keeps its local action. */
export function useAdminPrimaryAction(label: string, onClick: () => void) {
  const report = useContext(AdminPrimaryActionContext);
  const latest = useRef(onClick);
  useLayoutEffect(() => {
    latest.current = onClick;
  }, [onClick]);
  useEffect(() => {
    if (!report) return;
    report({ label, onClick: () => latest.current() });
    return () => report(undefined);
  }, [label, report]);
  return report !== null;
}
