import { X } from "lucide-react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "../../../../convex/_generated/api";
import type { FilterValues } from "./PDKSFilterBar";
import { STATUS_FILTER_LABELS } from "../statusMeta";

interface PDKSActiveFilterChipsProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}

export function PDKSActiveFilterChips({
  values,
  onChange,
}: PDKSActiveFilterChipsProps) {
  const companies = useQuery(api.companies.list, {});
  const departments = useQuery(api.departments.list);
  const positions = useQuery(api.positions.list, {});
  const shifts = useQuery(api.shifts.list, {});

  const chips: Array<{ key: string; label: string; clear: () => void }> = [];

  if (values.dateRange.from && values.dateRange.to) {
    const from = format(values.dateRange.from, "dd MMM", { locale: tr });
    const to = format(values.dateRange.to, "dd MMM yyyy", { locale: tr });
    chips.push({
      key: "date",
      label: `${from} - ${to}`,
      clear: () =>
        onChange({
          ...values,
          dateRange: { from: undefined, to: undefined },
          reportType: "daily",
        }),
    });
  }

  if (values.companyId) {
    const c = companies?.find((x) => x._id === values.companyId);
    chips.push({
      key: "company",
      label: `Şirket: ${c?.name ?? "—"}`,
      clear: () => onChange({ ...values, companyId: undefined }),
    });
  }
  if (values.departmentId) {
    const d = departments?.find((x) => x._id === values.departmentId);
    chips.push({
      key: "dept",
      label: `Departman: ${d?.name ?? "—"}`,
      clear: () => onChange({ ...values, departmentId: undefined }),
    });
  }
  if (values.positionId) {
    const p = positions?.find((x) => x._id === values.positionId);
    chips.push({
      key: "pos",
      label: `Pozisyon: ${p?.name ?? "—"}`,
      clear: () => onChange({ ...values, positionId: undefined }),
    });
  }
  if (values.shiftId) {
    const s = shifts?.find((x) => x._id === values.shiftId);
    chips.push({
      key: "shift",
      label: `Vardiya: ${s?.name ?? "—"}`,
      clear: () => onChange({ ...values, shiftId: undefined }),
    });
  }
  if (values.statusFilter !== "all") {
    chips.push({
      key: "status",
      label: `Durum: ${STATUS_FILTER_LABELS[values.statusFilter]}`,
      clear: () => onChange({ ...values, statusFilter: "all" }),
    });
  }
  if (values.person) {
    chips.push({
      key: "person",
      label: `Personel: ${values.person}`,
      clear: () => onChange({ ...values, person: "" }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pr-1 text-xs font-normal"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.clear}
            className="ml-0.5 rounded-full hover:bg-background/60 p-0.5"
            aria-label="Filtreyi kaldır"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {chips.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] text-muted-foreground"
          onClick={() =>
            onChange({
              dateRange: { from: undefined, to: undefined },
              reportType: "daily",
              companyId: undefined,
              departmentId: undefined,
              positionId: undefined,
              shiftId: undefined,
              statusFilter: "all",
              person: "",
            })
          }
        >
          Hepsini temizle
        </Button>
      )}
    </div>
  );
}
