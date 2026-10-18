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
  return <>{remoteChanged && <p role="status" className="text-sm text-muted-foreground">Bu bölüm başka bir oturumda değişti. Taslağınız korundu; güncel kaydı yüklemek için Vazgeç’i seçin.</p>}
    {failed && <p role="alert" className="text-sm text-destructive">Değişiklikler kaydedilemedi. Bilgilerinizi koruduk; yeniden deneyin.</p>}</>;
}
