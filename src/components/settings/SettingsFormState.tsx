import { FormFeedback } from "@/components/shared/FormFeedback";
import { createContext, useContext, useEffect, useState } from "react";

export interface FormState { dirty: boolean; pending: boolean }
export const SettingsFormState = createContext<(id: string, state: FormState | null) => void>(() => undefined);

/** Reports each mounted form separately, including immediate operations and dialogs. */
export function useSettingsFormState(id: string, dirty: boolean, pending: boolean) {
  const report = useContext(SettingsFormState);
  useEffect(() => { report(id, { dirty, pending }); }, [report, id, dirty, pending]);
  useEffect(() => () => report(id, null), [report, id]);
}

export function sameValues<T>(a: T, b: T) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Freeze the editing snapshot; background subscriptions never overwrite a draft. */
export function useSettingsDraft<T extends object>(source: T) {
  const [draft, setDraft] = useState<{ base: T; values: T } | null>(null);
  const dirty = draft !== null && !sameValues(draft.values, draft.base);
  const values = dirty && draft ? draft.values : source;
  return {
    values,
    /** Snapshot the draft started from; lets a form send only the fields the user changed. */
    baseline: dirty && draft ? draft.base : source,
    dirty,
    remoteChanged: dirty && draft !== null && !sameValues(draft.base, source),
    change: (fields: Partial<T>) => setDraft(previous => {
      const editing = previous && !sameValues(previous.values, previous.base);
      return { base: editing ? previous.base : source, values: { ...(editing ? previous.values : source), ...fields } };
    }),
    reset: () => setDraft(null),
  };
}

export function DraftNotice({ remoteChanged, failed }: { remoteChanged?: boolean; failed?: boolean }) {
  return <>{remoteChanged && <FormFeedback tone="info">Bu bölüm başka bir oturumda değişti. Taslağınız korundu; güncel kaydı yüklemek için Vazgeç’i seçin.</FormFeedback>}
    {failed && <FormFeedback tone="error">Değişiklikler kaydedilemedi. Bilgilerinizi koruduk; yeniden deneyin.</FormFeedback>}</>;
}
