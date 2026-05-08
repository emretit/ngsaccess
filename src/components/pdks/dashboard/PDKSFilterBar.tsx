import { useEffect, useRef, useState } from "react";
import { CalendarIcon, Search, X } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type ReportType = "daily" | "weekly" | "monthly" | "custom";
export type StatusFilter = "all" | "present" | "late" | "absent" | "leave" | "overtime";

export interface FilterValues {
  dateRange: { from: Date | undefined; to: Date | undefined };
  reportType: ReportType;
  companyId?: Id<"companies">;
  departmentId?: Id<"departments">;
  positionId?: Id<"positions">;
  shiftId?: Id<"shifts">;
  statusFilter: StatusFilter;
  person: string;
}

interface PDKSFilterBarProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}

const QUICK_CHIPS: Array<{
  key: string;
  label: string;
  apply: (current: FilterValues) => FilterValues;
}> = [
  {
    key: "today-late",
    label: "Bugün geç kalanlar",
    apply: (c) => ({ ...c, reportType: "daily", statusFilter: "late" }),
  },
  {
    key: "week-absent",
    label: "Bu hafta hiç gelmeyenler",
    apply: (c) => ({ ...c, reportType: "weekly", statusFilter: "absent" }),
  },
  {
    key: "today-overtime",
    label: "Mesai yapanlar",
    apply: (c) => ({ ...c, reportType: "daily", statusFilter: "overtime" }),
  },
  {
    key: "week-leave",
    label: "Bu hafta izinde olanlar",
    apply: (c) => ({ ...c, reportType: "weekly", statusFilter: "leave" }),
  },
];

export function PDKSFilterBar({ values, onChange }: PDKSFilterBarProps) {
  const departments = useQuery(api.departments.list);
  const companies = useQuery(api.companies.list, {});
  const positions = useQuery(api.positions.list, {});
  const shifts = useQuery(api.shifts.list, {});

  // Person input için debounce
  const [personDraft, setPersonDraft] = useState(values.person);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (personDraft === values.person) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ ...values, person: personDraft });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [personDraft, onChange, values]);

  // Dış kaynaktan değişirse senkronize et (chip vs.)
  useEffect(() => {
    if (values.person !== personDraft) setPersonDraft(values.person);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.person]);

  const update = (patch: Partial<FilterValues>) => {
    onChange({ ...values, ...patch });
  };

  const clearAll = () => {
    onChange({
      dateRange: { from: undefined, to: undefined },
      reportType: "daily",
      companyId: undefined,
      departmentId: undefined,
      positionId: undefined,
      shiftId: undefined,
      statusFilter: "all",
      person: "",
    });
    setPersonDraft("");
  };

  const activeCount =
    (values.dateRange.from ? 1 : 0) +
    (values.reportType !== "daily" ? 1 : 0) +
    (values.companyId ? 1 : 0) +
    (values.departmentId ? 1 : 0) +
    (values.positionId ? 1 : 0) +
    (values.shiftId ? 1 : 0) +
    (values.statusFilter !== "all" ? 1 : 0) +
    (values.person ? 1 : 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Quick chips */}
      <div className="flex flex-wrap gap-2">
        {QUICK_CHIPS.map((chip) => (
          <Button
            key={chip.key}
            variant="outline"
            size="sm"
            className="h-7 text-xs rounded-full"
            onClick={() => onChange(chip.apply(values))}
          >
            {chip.label}
          </Button>
        ))}
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs ml-auto text-muted-foreground"
            onClick={clearAll}
          >
            <X className="h-3 w-3 mr-1" />
            Filtreleri temizle
            <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
              {activeCount}
            </Badge>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
        {/* Tarih aralığı */}
        <div className="col-span-2 md:col-span-3 lg:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Tarih Aralığı
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full justify-start text-left font-normal h-9",
                  !values.dateRange.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {values.dateRange.from ? (
                  values.dateRange.to ? (
                    <>
                      {format(values.dateRange.from, "dd MMM", { locale: tr })} -{" "}
                      {format(values.dateRange.to, "dd MMM yyyy", { locale: tr })}
                    </>
                  ) : (
                    format(values.dateRange.from, "dd MMM yyyy", { locale: tr })
                  )
                ) : (
                  <span>Tarih seçin</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={values.dateRange.from}
                selected={values.dateRange}
                onSelect={(range) =>
                  update({
                    dateRange: { from: range?.from, to: range?.to },
                    reportType: range?.from && range?.to ? "custom" : values.reportType,
                  })
                }
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Rapor türü */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Rapor
          </label>
          <Select
            value={values.reportType}
            onValueChange={(v) => update({ reportType: v as ReportType })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Günlük</SelectItem>
              <SelectItem value="weekly">Haftalık</SelectItem>
              <SelectItem value="monthly">Aylık</SelectItem>
              <SelectItem value="custom">Özel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Şirket */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Şirket
          </label>
          <Select
            value={values.companyId ?? "all"}
            onValueChange={(v) =>
              update({ companyId: v === "all" ? undefined : (v as Id<"companies">) })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {companies?.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Departman */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Departman
          </label>
          <Select
            value={values.departmentId ?? "all"}
            onValueChange={(v) =>
              update({ departmentId: v === "all" ? undefined : (v as Id<"departments">) })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {departments?.map((d) => (
                <SelectItem key={d._id} value={d._id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pozisyon */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Pozisyon
          </label>
          <Select
            value={values.positionId ?? "all"}
            onValueChange={(v) =>
              update({ positionId: v === "all" ? undefined : (v as Id<"positions">) })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {positions?.map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vardiya */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Vardiya
          </label>
          <Select
            value={values.shiftId ?? "all"}
            onValueChange={(v) =>
              update({ shiftId: v === "all" ? undefined : (v as Id<"shifts">) })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {shifts?.map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Durum
          </label>
          <Select
            value={values.statusFilter}
            onValueChange={(v) => update({ statusFilter: v as StatusFilter })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="present">Mevcut</SelectItem>
              <SelectItem value="late">Geç kalan</SelectItem>
              <SelectItem value="absent">Yok / Devamsız</SelectItem>
              <SelectItem value="leave">İzinli</SelectItem>
              <SelectItem value="overtime">Mesai yapan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Personel arama */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Personel ara
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Ad veya soyad ile ara..."
              value={personDraft}
              onChange={(e) => setPersonDraft(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
