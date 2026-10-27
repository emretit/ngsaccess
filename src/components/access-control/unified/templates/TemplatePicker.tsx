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
  const selectable = rows?.filter((t) => !t.isArchived || t._id === currentTemplateId);
  const selected = rows?.find((t) => t._id === value);
  // Şablonlar sekmesine geçiş; çağıranın kaydedilmemiş değişiklik onayı (onEdit) varsa ondan geçer.
  const openTemplates = (templateId?: string) => {
    const navigate = () => setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "templates");
      if (templateId) next.set("template", templateId);
      else next.delete("template");
      return next;
    });
    if (onEdit) onEdit(navigate);
    else navigate();
  };
  return (
    <div className="space-y-3">
      {selectable?.length === 0 ? (
        <>
          <p className="text-sm font-medium">Zaman şablonu</p>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {rows?.length ? "Seçilebilir zaman şablonu yok (yalnız arşivlenmiş şablonlar var)." : "Bu projede henüz zaman şablonu yok."}
            </p>
            {canManage && <Button type="button" variant="outline" onClick={() => openTemplates()}>Zaman şablonu oluştur</Button>}
          </div>
        </>
      ) : (
        <>
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
            {selectable?.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
                {t.isArchived ? " (arşivli)" : ""}
              </option>
            ))}
          </NativeSelect>
        </>
      )}
      {selected && (
        <>
          <WeekPreview week={selected.week} />
          {canManage && (
            <Button
              type="button"
              variant="link"
              onClick={() => openTemplates(selected._id)}
            >
              Şablonu düzenle
            </Button>
          )}
        </>
      )}
    </div>
  );
}
