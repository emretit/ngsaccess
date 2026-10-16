export type NullablePatch<T> = {
  [K in keyof T]?: Exclude<T[K], null> | undefined;
};

/** Düz alanlar: undefined dokunmaz, null alanı Convex patch ile siler. */
export function toPatch<T extends Record<string, unknown>>(args: T): NullablePatch<T> {
  return Object.fromEntries(
    Object.entries(args)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value === null ? undefined : value]),
  ) as NullablePatch<T>;
}
