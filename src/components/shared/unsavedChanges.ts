/** UI dışındaki karar mantığı: iptal edilen kapanış daha sonra çalıştırılmaz. */
export function createUnsavedChangesGuard() {
  let pending: (() => void) | null = null;
  return {
    request(isDirty: boolean, close: () => void): boolean {
      if (!isDirty) { pending = null; close(); return false; }
      pending = close;
      return true;
    },
    cancel() { pending = null; },
    confirm() {
      const close = pending;
      pending = null;
      close?.();
    },
  };
}
