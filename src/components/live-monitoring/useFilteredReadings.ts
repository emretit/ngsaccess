import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
type Args = Omit<FunctionArgs<typeof api.cardReadings.listFiltered>, "paginationOpts">;
type Page = FunctionReturnType<typeof api.cardReadings.listFiltered>;
// A szülő a szerveroldali szűrők változásakor újramountolja; a helyi szöveges keresés nem resetel.
export function useFilteredReadings(args: Args | undefined) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [pages, setPages] = useState<{ cursor: string | null; value: Page }[]>([]);
  const response = useQuery(api.cardReadings.listFiltered, args ? { ...args, paginationOpts: { numItems: 100, cursor } } : "skip");
  useEffect(() => {
    if (response) setPages(previous => previous.some(p => p.cursor === cursor) ? previous : [...previous, { cursor, value: response }]);
  }, [response, cursor]);
  const page = pages.find(p => p.cursor === cursor)?.value;
  const loading = !page;
  return { rows: [...new Map(pages.flatMap(p => p.value.page).map(row => [row._id, row])).values()], scannedCount: pages.reduce((sum, p) => sum + p.value.scannedCount, 0), filterScope: page?.filterScope, loading, isDone: page?.isDone ?? false,
    loadMore: () => { if (page && !page.isDone && !loading) setCursor(page.continueCursor); } };
}
