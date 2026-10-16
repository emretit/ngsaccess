export type ActionResult =
  | { status: "success" }
  | { status: "ignored" }
  | { status: "error"; error: unknown };

/** React render'ını beklemeden kilitlenir; hata ve başarıdan sonra yeniden kullanılabilir. */
export function createAsyncGuard() {
  let pending = false;
  return {
    get pending() { return pending; },
    async run(action: () => Promise<unknown>): Promise<ActionResult> {
      if (pending) return { status: "ignored" };
      pending = true;
      try {
        await action();
        return { status: "success" };
      } catch (error: unknown) {
        return { status: "error", error };
      } finally {
        pending = false;
      }
    },
  };
}
