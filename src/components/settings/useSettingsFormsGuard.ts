import { useCallback, useContext, useEffect, useState } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";
import type { FormState } from "./SettingsFormState";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useProjectChangeGuard } from "@/contexts/ActiveProjectContext";
import { installNavigationGuard } from "@/lib/navigationGuard";

/** Collects mounted settings forms (via SettingsFormState.Provider) and guards navigation/project changes while any is dirty or saving. */
export function useSettingsFormsGuard() {
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const reportForm = useCallback((id: string, state: FormState | null) => setForms(previous => {
    if (state && previous[id]?.dirty === state.dirty && previous[id]?.pending === state.pending) return previous;
    const next = { ...previous };
    if (state) next[id] = state; else delete next[id];
    return next;
  }), []);
  const dirty = Object.values(forms).some(form => form.dirty);
  const pending = Object.values(forms).some(form => form.pending);
  const blocking = dirty || pending;
  const guard = useUnsavedChangesGuard(blocking);
  useProjectChangeGuard(blocking, pending ? () => undefined : guard.requestClose);
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const { requestClose } = guard;
  useEffect(() => {
    if (!blocking) return;
    return installNavigationGuard(navigator, proceed => { if (!pending) requestClose(proceed); }, window, pending);
  }, [blocking, pending, navigator, requestClose]);
  return { reportForm, pending, dialog: guard.dialog };
}
