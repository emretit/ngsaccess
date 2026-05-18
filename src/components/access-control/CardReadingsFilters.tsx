import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarIcon, RefreshCw, Search, ScanLine } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface CardReadingsFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  dateFilter: Date | undefined;
  setDateFilter: (value: Date | undefined) => void;
  accessFilter: "all" | "granted" | "denied";
  setAccessFilter: (value: "all" | "granted" | "denied") => void;
  handleRefresh: () => void;
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
}

export const CardReadingsFilters = ({
  searchTerm,
  setSearchTerm,
  dateFilter,
  setDateFilter,
  accessFilter,
  setAccessFilter,
  handleRefresh,
  totalCount = 0,
  currentPage = 1,
  pageSize = 100,
}: CardReadingsFiltersProps) => {
  const startIdx = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="rounded-xl border bg-card shadow-xs p-4 md:p-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 mr-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <ScanLine className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">
              Kart Okutma Geçmişi
            </h2>
            <p className="text-xs text-muted-foreground">
              {totalCount > 0
                ? `${totalCount} kayıttan ${startIdx}-${endIdx} arası`
                : "Kayıt yok"}
            </p>
          </div>
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Çalışan veya kart no..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateFilter ? format(dateFilter, "dd.MM.yyyy") : "Tarih"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateFilter}
                onSelect={setDateFilter}
                initialFocus
              />
              {dateFilter && (
                <div className="p-2 border-t flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDateFilter(undefined)}
                  >
                    Temizle
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Select
            value={accessFilter}
            onValueChange={(value) =>
              setAccessFilter(value as "all" | "granted" | "denied")
            }
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Tümü
              </SelectItem>
              <SelectItem value="granted" className="text-xs">
                İzin Verilenler
              </SelectItem>
              <SelectItem value="denied" className="text-xs">
                Reddedilenler
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            title="Yenile"
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
