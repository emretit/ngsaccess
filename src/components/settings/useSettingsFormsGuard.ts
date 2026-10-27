import { useCallback, useState } from "react";
import type { FormState } from "./SettingsFormState";
import { useGuardedFormNavigation } from "@/hooks/useGuardedFormNavigation";

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
  const guard = useGuardedFormNavigation({ dirty: dirty || pending, pending });
  return { reportForm, pending, dialog: guard.dialog };
}
