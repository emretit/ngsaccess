import type { AriaAttributes } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../../../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Button } from "@/components/ui/button";
import { WeekPreview } from "./WeekPreview";
export function TemplatePicker({
  value,
  currentTemplateId,
  onChange,
  onEdit,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
}: {
  value: string;
  currentTemplateId?: string;
  onChange: (value: string) => void;
  onEdit?: (navigate: () => void) => void;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  "aria-describedby"?: string;
}) {
  const { projectId } = useActiveProject();
  const { can } = usePermissions();
  const canManage = can("accessRules.manage");
  const rows = useQuery(
    api.accessScheduleTemplates.list,
    projectId ? { projectId, includeArchived: true } : "skip",
  );
  const [, setParams] = useSearchParams();
  const selected = rows?.find((t) => t._id === value);
  return (
    <div className="space-y-3">
      <label htmlFor="rule-schedule-template" className="text-sm font-medium">
        Zaman şablonu
      </label>
      <NativeSelect
        id="rule-schedule-template"
        className="w-full min-w-0"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{rows ? "Şablon seçin" : "Yükleniyor…"}</option>
        {rows
          ?.filter((t) => !t.isArchived || t._id === currentTemplateId)
          .map((t) => (
            <option key={t._id} value={t._id}>
              {t.name}
              {t.isArchived ? " (arşivli)" : ""}
            </option>
          ))}
      </NativeSelect>
      {selected && (
        <>
          <WeekPreview week={selected.week} />
          {canManage && (
            <Button
              type="button"
              variant="link"
              onClick={() => {
                const navigate = () => setParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("tab", "templates");
                  next.set("template", selected._id);
                  return next;
                });
                if (onEdit) onEdit(navigate);
                else navigate();
              }}
            >
              Şablonu düzenle
            </Button>
          )}
        </>
      )}
    </div>
  );
}
