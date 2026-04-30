import { useState } from "react";
import { CalendarIcon, Filter, Search } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface PDKSFilterBarProps {
  onFiltersChange: (filters: {
    dateRange: DateRange;
    department: string;
    person: string;
    reportType: string;
  }) => void;
}

export function PDKSFilterBar({ onFiltersChange }: PDKSFilterBarProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [department, setDepartment] = useState<string>("all");
  const [person, setPerson] = useState<string>("");
  const [reportType, setReportType] = useState<string>("daily");

  const departments = useQuery(api.departments.list);

  const handleApplyFilters = () => {
    onFiltersChange({ dateRange, department, person, reportType });
  };

  const handleDateRangeChange = (range: { from?: Date; to?: Date } | undefined) => {
    setDateRange({ from: range?.from, to: range?.to });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Tarih Aralığı
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd MMM yyyy", { locale: tr })} -{" "}
                        {format(dateRange.to, "dd MMM yyyy", { locale: tr })}
                      </>
                    ) : (
                      format(dateRange.from, "dd MMM yyyy", { locale: tr })
                    )
                  ) : (
                    <span>Tarih aralığı seçin</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={dateRange}
                  onSelect={handleDateRangeChange}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Departman
            </label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-9">
                <SelectValue
                  placeholder={
                    departments === undefined ? "Yükleniyor..." : "Departman seçin"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Departmanlar</SelectItem>
                {departments?.map((d) => (
                  <SelectItem key={d._id} value={d._id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Personel Arama
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Ad, soyad ara..."
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Rapor Türü
            </label>
            <Select
              value={reportType}
              onValueChange={(v) => {
                setReportType(v);
                onFiltersChange({ dateRange, department, person, reportType: v });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Rapor türü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Günlük</SelectItem>
                <SelectItem value="weekly">Haftalık</SelectItem>
                <SelectItem value="monthly">Aylık</SelectItem>
                <SelectItem value="custom">Özel Aralık</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={handleApplyFilters} size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filtreleri Uygula
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateRange({ from: undefined, to: undefined });
              setDepartment("all");
              setPerson("");
              setReportType("daily");
              onFiltersChange({
                dateRange: { from: undefined, to: undefined },
                department: "all",
                person: "",
                reportType: "daily",
              });
            }}
          >
            Filtreleri Temizle
          </Button>
        </div>
      </div>
    </div>
  );
}
