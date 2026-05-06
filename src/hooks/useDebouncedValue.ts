import { useEffect, useState } from "react";

/**
 * Returns a value that only updates after the input value has been stable for `delay` ms.
 * Useful for keeping UI inputs responsive while delaying expensive downstream work
 * (Convex queries, filtering, etc.).
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
