
import { useState } from "react";
import { CalendarIcon, Filter, Download, Search } from "lucide-react";
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
      reportType,
    });
  };

  const handleDateRangeChange = (range: any) => {
    setDateRange({
      from: range?.from,
      to: range?.to
    });
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 lg:p-6">
      <div className="flex flex-col gap-4">
        {/* Filter Title */}
        <div className="flex items-center gap-2 mb-2">
          <Filter className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Filtreler ve Arama
          </h3>
        </div>
        
        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Date Range Picker */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tarih Aralığı
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-10",
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

          {/* Department Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Departman
            </label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Departman seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Departmanlar</SelectItem>
                <SelectItem value="IT">Bilgi İşlem</SelectItem>
                <SelectItem value="HR">İnsan Kaynakları</SelectItem>
                <SelectItem value="Finance">Finans</SelectItem>
                <SelectItem value="Operations">Operasyon</SelectItem>
                <SelectItem value="Sales">Satış</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Person Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Personel Arama
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Ad, soyad ara..."
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
          </div>

          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rapor Türü
            </label>
            <Select
              value={reportType}
              onValueChange={(v) => {
                setReportType(v);
                onFiltersChange({
                  dateRange,
                  department,
                  person,
                  reportType: v,
                });
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Rapor türü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">📅 Günlük</SelectItem>
                <SelectItem value="weekly">📆 Haftalık</SelectItem>
                <SelectItem value="monthly">📊 Aylık</SelectItem>
                <SelectItem value="custom">📋 Özel Aralık</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button 
            onClick={handleApplyFilters} 
            className="bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtreleri Uygula
          </Button>
          
          <Button 
            variant="outline" 
            className="border-primary text-primary hover:bg-primary/5"
          >
            <Download className="mr-2 h-4 w-4" />
            Hızlı Dışa Aktar
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={() => {
              setDateRange({ from: undefined, to: undefined });
              setDepartment("all");
              setPerson("");
              setReportType("daily");
            }}
            className="text-gray-600 hover:text-gray-800"
          >
            Filtreleri Temizle
          </Button>
        </div>
      </div>
    </div>
  );
}
