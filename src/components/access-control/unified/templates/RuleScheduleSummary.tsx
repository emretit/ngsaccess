import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { formatSchedule } from "./schedule";
export function RuleScheduleSummary({
  templateId,
  projectId,
}: {
  templateId: Id<"accessScheduleTemplates">;
  projectId: Id<"projects">;
}) {
  const rows = useQuery(api.accessScheduleTemplates.list, {
    projectId,
    includeArchived: true,
  });
  if (!rows) return <span>Şablon yükleniyor…</span>;
  const template = rows.find((t) => t._id === templateId);
  return template ? (
    <span title={formatSchedule(template.week)} className="break-words">
      Şablon: {template.name}
    </span>
  ) : (
    <span className="text-danger">Şablon bulunamadı — erişim kapalı</span>
  );
}
