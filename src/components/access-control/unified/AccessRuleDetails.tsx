import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";

export function AccessRuleDetails({
  ruleId,
  projectId,
}: {
  ruleId: Id<"accessRules">;
  projectId: Id<"projects">;
}) {
  const rule = useQuery(api.accessRules.getDetails, { ruleId, projectId });
  if (!rule)
    return <SectionSkeleton rows={3} label="Kural ayrıntısı yükleniyor" />;
  return (
    <div className="grid gap-5 border-t pt-4 md:grid-cols-2">
      <section className="min-w-0">
        <h4 className="mb-2 text-sm font-semibold">
          Kişiler ({rule.groupMembers.length})
        </h4>
        {rule.groupMembers.length === 0 ? (
          <EmptyState title="Kişi seçilmemiş" />
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {rule.groupMembers.map((member) => (
              <li
                key={member._id}
                className="break-words rounded bg-muted p-2 text-sm"
              >
                {member.employees
                  ? `${member.employees.firstName} ${member.employees.lastName}`
                  : "Kişi kaydı bulunamadı"}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="min-w-0">
        <h4 className="mb-2 text-sm font-semibold">Panel ve kapı kapsamı</h4>
        {rule.unassignedDoors.length > 0 && (
          <p className="mb-2 text-sm text-muted-foreground">
            Panel bağlantısı olmayan kapılar:{" "}
            {rule.unassignedDoors.map((door) => door.name).join(", ")} — kapı
            kapsamı cihaza uygulanamaz.
          </p>
        )}
        {rule.panels.length === 0 ? (
          <EmptyState title="Kapı veya panel seçilmemiş" />
        ) : (
          <ul className="max-h-80 space-y-3 overflow-y-auto">
            {rule.panels.map((panel) => (
              <li key={panel.deviceId} className="rounded bg-muted p-2 text-sm">
                <p className="break-words font-medium">{panel.label}</p>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  {panel.doors.map((door) => (
                    <li key={door.doorId} className="break-words">
                      {door.zoneName ? `${door.zoneName} → ` : ""}
                      {door.name}
                    </li>
                  ))}
                </ul>
                {panel.wholePanel && panel.doors.length < panel.totalDoors && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Panelin adı tanımlanmamış kapıları da kapsamda.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
