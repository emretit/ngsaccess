import { usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { RecentRuns } from "./SyncRuns";
function Members({
  ruleId,
  kind,
}: {
  ruleId: Id<"accessRules">;
  kind: "people" | "devices" | "doors";
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.accessRules.listRuleMembers,
    { ruleId, kind },
    { initialNumItems: 25 },
  );
  return (
    <section className="min-w-0 space-y-2">
      <h3 className="font-semibold">
        {kind === "people"
          ? "Kişiler"
          : kind === "devices"
            ? "Paneller (kapı seçimi yoksa tüm cihaz)"
            : "Açık kapı seçimleri"}
      </h3>
      {status === "LoadingFirstPage" ? (
        <SectionSkeleton rows={2} />
      ) : (
        <>
          <ul className="divide-y">
            {results.map((row) => (
              <li key={row._id} className="py-2 break-words">
                {"employees" in row
                  ? row.employees
                    ? `${row.employees.firstName} ${row.employees.lastName}`
                    : "Kişi kaydı bulunamadı"
                  : "devices" in row
                    ? (row.devices?.name ?? "Cihaz kaydı bulunamadı")
                    : "doors" in row
                      ? (row.doors?.name ?? "Kapı kaydı bulunamadı")
                      : "İlişki bulunamadı"}
              </li>
            ))}
          </ul>
          {results.length === 0 && (
            <p className="text-muted-foreground text-xs">Kayıt yok.</p>
          )}
          {status !== "Exhausted" && (
            <Button
              variant="outline"
              disabled={status !== "CanLoadMore"}
              onClick={() => loadMore(25)}
            >
              {status === "LoadingMore" ? "Yükleniyor…" : "Daha fazla yükle"}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
export function AccessRuleDetails({
  ruleId,
  projectId,
}: {
  ruleId: Id<"accessRules">;
  projectId: Id<"projects">;
}) {
  return (
    <div className="mt-4 space-y-6 min-w-0">
      <p className="text-xs text-muted-foreground">
        Ziyaretçiler şablona Ziyaretçiler ekranından eklenir. Panel seçimi ve
        açık kapı seçimleri ayrı gösterilir; açık kapı seçimi olmayan panelde
        tüm cihaz kapsamı geçerlidir.
      </p>
      <Members key={`${ruleId}-people`} ruleId={ruleId} kind="people" />
      <Members key={`${ruleId}-devices`} ruleId={ruleId} kind="devices" />
      <Members key={`${ruleId}-doors`} ruleId={ruleId} kind="doors" />
      <RecentRuns projectId={projectId} ruleId={ruleId} />
    </div>
  );
}
