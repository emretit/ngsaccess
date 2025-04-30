
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Loader2, FilterIcon, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { EmployeePagination } from "@/components/employees/EmployeePagination";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface CardReading {
  id: number;
  employee_name: string;
  card_no: string;
  access_time: string;
  device_name: string;
  access_granted: boolean;
  status: string;
  device_location: string;
}

const CardReadings = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [accessFilter, setAccessFilter] = useState<'all' | 'granted' | 'denied'>('all');
  const PAGE_SIZE = 100;

  // Sayfa değiştiğinde veya filtreler uygulandığında reset
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, accessFilter]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["cardReadings", currentPage, searchTerm, dateFilter, accessFilter],
    queryFn: async () => {
      console.log("Fetching card readings for page:", currentPage);
      console.log("Filters:", { searchTerm, dateFilter, accessFilter });
      
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Sorgu oluşturma
      let query = supabase
        .from("card_readings")
        .select("*", { count: "exact" });
      
      // Arama filtresi
      if (searchTerm) {
        query = query.or(`employee_name.ilike.%${searchTerm}%,card_no.ilike.%${searchTerm}%,device_name.ilike.%${searchTerm}%`);
      }
      
      // Tarih filtresi
      if (dateFilter) {
        const startDate = new Date(dateFilter);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(dateFilter);
        endDate.setHours(23, 59, 59, 999);
        
        query = query
          .gte('access_time', startDate.toISOString())
          .lte('access_time', endDate.toISOString());
      }
      
      // Erişim durumu filtresi
      if (accessFilter === 'granted') {
        query = query.eq('access_granted', true);
      } else if (accessFilter === 'denied') {
        query = query.eq('access_granted', false);
      }
      
      // Sıralama ve sayfalama
      const { data, error, count } = await query
        .order("access_time", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("Error fetching card readings:", error);
        throw error;
      }
      
      console.log("Card readings fetched:", data);
      return {
        readings: data as CardReading[],
        totalCount: count || 0
      };
    },
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDateFilter(undefined);
    setAccessFilter('all');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        <p>Kart okutma kayıtları yüklenirken bir hata oluştu.</p>
        <p>{(error as Error).message}</p>
      </div>
    );
  }

  if (!data?.readings || data.readings.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Kart Okuma Kayıtları</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Yenile
            </Button>
          </div>
        </div>
        <Card>
          <div className="p-6 text-center text-muted-foreground">
            {searchTerm || dateFilter || accessFilter !== 'all' ? (
              <>
                <p>Arama kriterlerinize uygun kayıt bulunamadı.</p>
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="mt-2">
                  Filtreleri Temizle
                </Button>
              </>
            ) : (
              <p>Görüntülenecek kart okutma kaydı bulunamadı.</p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const totalPages = Math.ceil(data.totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <h2 className="text-2xl font-bold">Kart Okuma Kayıtları</h2>
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
            
            <Select value={accessFilter} onValueChange={(value) => setAccessFilter(value as typeof accessFilter)}>
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
      </div>

      <Card>
        <div className="p-6">
          <div className="mb-4 text-sm text-muted-foreground">
            {data.totalCount} kayıttan {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, data.totalCount)} arası görüntüleniyor
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Çalışan</TableHead>
                  <TableHead>Kart No</TableHead>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Cihaz</TableHead>
                  <TableHead>Konum</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Erişim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.readings.map((reading) => (
                  <TableRow key={reading.id}>
                    <TableCell>{reading.employee_name || "Bilinmeyen"}</TableCell>
                    <TableCell>{reading.card_no}</TableCell>
                    <TableCell>
                      {format(new Date(reading.access_time), "dd.MM.yyyy HH:mm:ss", { locale: tr })}
                    </TableCell>
                    <TableCell>{reading.device_name || "Bilinmeyen Cihaz"}</TableCell>
                    <TableCell>{reading.device_location || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={reading.status === "success" ? "success" : "destructive"}>
                        {reading.status === "success" ? "Başarılı" : "Hata"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-sm ${reading.access_granted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {reading.access_granted ? 'İzin Verildi' : 'Reddedildi'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4">
            <EmployeePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CardReadings;
