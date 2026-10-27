import { RuleScheduleSummary } from "./templates/RuleScheduleSummary";
import { usePaginatedQuery, useQuery } from "convex/react";
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
            ? "Cihazlar (kapı seçimi yoksa tüm cihaz)"
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
  const rule = useQuery(api.accessRules.getDetails, { ruleId, projectId });
  if (!rule) return <SectionSkeleton rows={3} label="Kural ayrıntısı yükleniyor" />;
  return (
    <div className="mt-4 space-y-6 min-w-0">
      {rule.scheduleTemplateId && (
        <RuleScheduleSummary
          templateId={rule.scheduleTemplateId}
          projectId={projectId}
        />
      )}
      {rule.targetType === "visitor" && (
        <p className="text-xs text-muted-foreground">
          Ziyaretçiler şablona Ziyaretçiler ekranından eklenir.
        </p>
      )}
      <Members key={`${ruleId}-people`} ruleId={ruleId} kind="people" />
      <section className="space-y-2">
        <h3 className="font-semibold">Cihazlar ve kapılar</h3>
        {rule.scopeTruncated && <p role="status">Kapsam çok geniş; tüm cihaz ve kapılar burada gösterilemiyor. Tam seçimleri düzenleme ekranından inceleyin.</p>}
        <ul className="space-y-3">
          {rule.panels.map((panel) => (
            <li key={panel.deviceId} className="break-words">
              <p className="font-medium">{panel.label}</p>
              <ul className="ml-4 list-disc">
                {panel.doors.map((door) => <li key={door.doorId}>{door.name}{door.zoneName ? ` · ${door.zoneName}` : ""}</li>)}
              </ul>
              {panel.doorsTruncated && <p className="text-xs text-muted-foreground">Tüm kapılar gösterilemiyor.</p>}
            </li>
          ))}
          {rule.unassignedDoors.map((door) => <li key={door.doorId}>{door.name} · Cihaz bağlantısı yok; cihaza uygulanamaz</li>)}
        </ul>
        {!rule.scopeTruncated && rule.panels.length === 0 && rule.unassignedDoors.length === 0 && <p className="text-xs text-muted-foreground">Kapı veya cihaz seçilmemiş.</p>}
      </section>
      <RecentRuns projectId={projectId} ruleId={ruleId} />
    </div>
  );
}
