
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
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { EmployeePagination } from "@/components/employees/EmployeePagination";

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
  const PAGE_SIZE = 100;

  const { data, isLoading, error } = useQuery({
    queryKey: ["cardReadings", currentPage],
    queryFn: async () => {
      console.log("Fetching card readings for page:", currentPage);
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // First, get total count
      const { count } = await supabase
        .from("card_readings")
        .select("*", { count: "exact", head: true });

      // Then get paginated data
      const { data, error } = await supabase
        .from("card_readings")
        .select("*")
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
        <h2 className="text-2xl font-bold">Kart Okuma Kayıtları</h2>
        <Card>
          <div className="p-6 text-center text-muted-foreground">
            Görüntülenecek kart okutma kaydı bulunamadı.
          </div>
        </Card>
      </div>
    );
  }

  const totalPages = Math.ceil(data.totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Kart Okuma Kayıtları</h2>
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
                      {format(new Date(reading.access_time), "dd.MM.yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>{reading.device_name || "Bilinmeyen Cihaz"}</TableCell>
                    <TableCell>{reading.device_location || "-"}</TableCell>
                    <TableCell>{reading.status}</TableCell>
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
