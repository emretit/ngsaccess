
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterIcon, RefreshCw } from "lucide-react";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { format } from "date-fns";

interface CardReadingsFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  dateFilter: Date | undefined;
  setDateFilter: (value: Date | undefined) => void;
  accessFilter: 'all' | 'granted' | 'denied';
  setAccessFilter: (value: 'all' | 'granted' | 'denied') => void;
  handleRefresh: () => void;
}

export const CardReadingsFilters = ({
  searchTerm,
  setSearchTerm,
  dateFilter,
  setDateFilter,
  accessFilter,
  setAccessFilter,
  handleRefresh
}: CardReadingsFiltersProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative w-full sm:w-auto">
        <Input
          className="pr-10 w-full sm:w-64"
          placeholder="Çalışan veya Kart No ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button 
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => setSearchTerm("")}
          >
            ✕
          </button>
        )}
      </div>
      
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <FilterIcon className="h-4 w-4 mr-2" />
              {dateFilter ? format(dateFilter, "dd.MM.yyyy") : "Tarih Filtrele"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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
        
        <Select value={accessFilter} onValueChange={(value) => setAccessFilter(value as 'all' | 'granted' | 'denied')}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Erişim Durumu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="granted">İzin Verilenler</SelectItem>
            <SelectItem value="denied">Reddedilenler</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" size="icon" onClick={handleRefresh} title="Yenile">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
