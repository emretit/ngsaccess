import { createContext, useContext, useEffect, useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react";
export type AccessControlHeaderAction = { label: string; onClick: () => void; disabled: boolean };
export const AccessControlHeaderContext = createContext<Dispatch<SetStateAction<AccessControlHeaderAction | undefined>> | null>(null);
export function useAccessControlHeader(label: string, onClick: () => void, disabled: boolean) {
  const report = useContext(AccessControlHeaderContext);
  const latest = useRef(onClick);
  useLayoutEffect(() => { latest.current = onClick; }, [onClick]);
  useEffect(() => {
    if (!report) return;
    report({ label, onClick: () => latest.current(), disabled });
    return () => report(undefined);
  }, [label, disabled, report]);
  return report !== null;
}
