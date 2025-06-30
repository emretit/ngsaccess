
import { useState } from "react";
import { CalendarIcon, Filter, Download } from "lucide-react";
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
  PopoverTrigger
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
  onFiltersChange: (filters: any) => void;
}

export function PDKSFilterBar({ onFiltersChange }: PDKSFilterBarProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined
  });
  const [department, setDepartment] = useState<string>("all");
  const [person, setPerson] = useState<string>("");
  const [reportType, setReportType] = useState<string>("daily");

  const handleApplyFilters = () => {
    onFiltersChange({
      dateRange,
      department,
      person,
      reportType
    });
  };

  return (
    <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Date Range Picker */}
        <div className="flex items-center space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
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
                onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Department Filter */}
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Departman" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Departmanlar</SelectItem>
            <SelectItem value="IT">IT</SelectItem>
            <SelectItem value="HR">İnsan Kaynakları</SelectItem>
            <SelectItem value="Finance">Finans</SelectItem>
            <SelectItem value="Operations">Operasyon</SelectItem>
          </SelectContent>
        </Select>

        {/* Person Search */}
        <Input
          placeholder="Personel ara..."
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className="w-[200px]"
        />

        {/* Report Type */}
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Rapor Tipi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Günlük</SelectItem>
            <SelectItem value="monthly">Aylık</SelectItem>
            <SelectItem value="overtime">Mesai</SelectItem>
            <SelectItem value="leave">İzin</SelectItem>
            <SelectItem value="entry-exit">Giriş/Çıkış</SelectItem>
          </SelectContent>
        </Select>

        {/* Apply Filter Button */}
        <Button onClick={handleApplyFilters} className="bg-[#711A1A] hover:bg-[#711A1A]/90">
          <Filter className="mr-2 h-4 w-4" />
          Filtrele
        </Button>

        {/* Export Button */}
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Dışa Aktar
        </Button>
      </div>
    </div>
  );
}
