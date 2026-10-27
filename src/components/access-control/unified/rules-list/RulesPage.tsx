import { RulesEmptyState } from "./RulesEmptyState";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { PaginationBar } from "@/components/shared/PaginationBar";
import { RuleRow } from "./RuleRow";
import type { Props } from "./types";
export function RulesPage({
  projectId,
  search,
  searchBy,
  status,
  type,
  onEditRule,
  onCreateRule,
  clear,
}: Props & {
  projectId: Id<"projects">;
  search: string;
  searchBy: "rule" | "person" | "door";
  status: "all" | "active" | "inactive";
  type: "all" | "visitor" | "personnel";
  clear: () => void;
}) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const result = useQuery(api.accessRules.listSummaries, {
    projectId,
    search,
    searchBy,
    status,
    type,
    paginationOpts: {
      cursor: cursors[cursors.length - 1] ?? null,
      numItems: 20,
    },
  });
  if (!result)
    return <SectionSkeleton rows={4} label="Erişim kuralları yükleniyor" />;
  const rows = result.page;
  return (
    <div className="space-y-3 min-w-0">
      {result.searchLimited ? (
        <EmptyState
          title="Aramayı daraltın"
          description="Çok fazla eşleşme var. Daha uzun bir kişi veya kapı adı yazın."
        />
      ) : rows.length === 0 ? (
        <RulesEmptyState
          search={search}
          status={status}
          type={type}
          isDone={result.isDone}
          clear={clear}
          onCreateRule={onCreateRule}
        />
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-md border">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Kural</TableHead>
                <TableHead className="hidden lg:table-cell w-32">Tür</TableHead>
                <TableHead className="hidden lg:table-cell w-24">Kim</TableHead>
                <TableHead className="hidden md:table-cell w-[24%]">
                  Nereye
                </TableHead>
                <TableHead className="hidden xl:table-cell w-40">
                  Ne zaman
                </TableHead>
                <TableHead className="w-20">Durum</TableHead>
                <TableHead className="w-14">
                  <span className="sr-only">İşlemler</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((rule) => (
                <RuleRow
                  key={rule._id}
                  rule={rule}
                  projectId={projectId}
                  onEditRule={onEditRule}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationBar
        className="max-md:[&_button]:min-h-11"
        summary={`Sayfa ${cursors.length} · ${rows.length} kural gösteriliyor`}
        page={cursors.length}
        onPrevious={() => setCursors((prev) => prev.slice(0, -1))}
        onNext={() => setCursors((prev) => [...prev, result.continueCursor])}
        nextDisabled={result.isDone}
      />
    </div>
  );
}
