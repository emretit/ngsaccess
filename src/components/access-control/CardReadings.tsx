
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

interface CardReading {
  id: number;
  employee_name: string;
  card_no: string;
  access_time: string;
  device_name: string;
  access_granted: boolean;
  status: string;
}

const CardReadings = () => {
  const { data: readings, isLoading, error } = useQuery({
    queryKey: ["cardReadings"],
    queryFn: async () => {
      console.log("Fetching card readings...");
      const { data, error } = await supabase
        .from("card_readings")
        .select("*")
        .order("access_time", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching card readings:", error);
        throw error;
      }
      
      console.log("Card readings fetched:", data);
      return data as CardReading[];
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

  if (!readings || readings.length === 0) {
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Kart Okuma Kayıtları</h2>
      <Card>
        <div className="p-6">
          <div className="mb-4 text-sm text-muted-foreground">
            Toplam {readings.length} kayıt görüntüleniyor.
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Çalışan</TableHead>
                  <TableHead>Kart No</TableHead>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Cihaz</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Erişim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.map((reading) => (
                  <TableRow key={reading.id}>
                    <TableCell>{reading.employee_name || "Bilinmeyen"}</TableCell>
                    <TableCell>{reading.card_no}</TableCell>
                    <TableCell>
                      {format(new Date(reading.access_time), "dd.MM.yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>{reading.device_name || "Bilinmeyen Cihaz"}</TableCell>
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
        </div>
      </Card>
    </div>
  );
};

export default CardReadings;
