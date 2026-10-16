import { useCallback, useRef, useState } from "react";
import { createAsyncGuard } from "@/lib/asyncGuard";
import { notify } from "@/lib/notify";

export interface AsyncActionOptions {
  success?: string;
  error?: string;
}

/** run yalnız tamamlanan başarılı işlemde true döner; hata/çift çağrıda false. */
export function useAsyncAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<unknown>,
  { success, error = "İşlem tamamlanamadı" }: AsyncActionOptions = {},
) {
  const guard = useRef(createAsyncGuard());
  const [pending, setPending] = useState(false);

  const run = useCallback(async (...args: Args): Promise<boolean> => {
    if (guard.current.pending) return false;
    setPending(true);
    const result = await guard.current.run(() => action(...args));
    setPending(false);
    if (result.status === "error") notify.error(error, result.error);
    if (result.status === "success" && success) notify.success(success);
    return result.status === "success";
  }, [action, success, error]);

  return { run, pending };
}
