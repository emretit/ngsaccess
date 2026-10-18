import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import type { FieldControlProps } from "@/components/shared/FormFieldWrapper";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";

export const selectClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
export function EmployeePicker({
  projectId,
  value,
  onChange,
  control,
  disabled,
}: {
  projectId: Id<"projects">;
  value: string;
  onChange: (value: string) => void;
  control: FieldControlProps;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: string; label: string }>();
  const data = useQuery(api.leaves.employeeOptions, {
    projectId,
    search: search || undefined,
  });
  return (
    <div className="min-w-0 space-y-2">
      <Input
        id={`${control.id}-search`}
        aria-label="Kişi ara"
        value={search}
        disabled={disabled}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Ad veya departman"
      />
      {data === undefined ? (
        <SectionSkeleton rows={1} label="Kişiler yükleniyor." />
      ) : (
        <>
          <select
            {...control}
            required
            value={value}
            disabled={disabled}
            className={selectClass}
            onChange={(event) => {
              const option = data.options.find(
                (item) => item._id === event.target.value,
              );
              if (option)
                setSelected({
                  id: option._id,
                  label: `${option.employeeName} · ${option.departmentName ?? "Departman belirtilmemiş"}`,
                });
              onChange(event.target.value);
            }}
          >
            <option value="">Kişi seçin</option>
            {value && !data.options.some((item) => item._id === value) && (
              <option value={value}>{selected?.label ?? "Seçili kişi"}</option>
            )}
            {data.options.map((item) => (
              <option key={item._id} value={item._id}>
                {item.employeeName} ·{" "}
                {item.departmentName ?? "Departman belirtilmemiş"}
              </option>
            ))}
          </select>
          {!data.options.length && (
            <p className="text-xs text-muted-foreground">
              {search
                ? "Bu aramayla eşleşen kişi yok."
                : "Bu projede seçilebilecek kişi yok."}{" "}
              <Link className="underline" to="/employees">
                Kişiler
              </Link>
            </p>
          )}
          {data.truncated && (
            <p className="text-xs text-muted-foreground">
              Seçenekler sınırlıdır; aramayı daraltın. Büyük projelerde tüm
              kişiler aramada bulunmayabilir.
            </p>
          )}
        </>
      )}
    </div>
  );
}
