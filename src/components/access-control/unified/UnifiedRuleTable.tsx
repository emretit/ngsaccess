
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AccessRule } from "@/types/access-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const UnifiedRuleTable = () => {
  const { data: rules, isLoading } = useQuery({
    queryKey: ['access-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_rules')
        .select(`
          *,
          employees (
            first_name,
            last_name
          ),
          devices (
            name
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as (AccessRule & {
        employees: { first_name: string; last_name: string } | null;
        devices: { name: string } | null;
      })[];
    }
  });

  if (isLoading) return <div>Yükleniyor...</div>;

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/50">
            <TableHead className="font-semibold">Kural Adı</TableHead>
            <TableHead className="font-semibold">Kapsam</TableHead>
            <TableHead className="font-semibold">Erişim Noktaları</TableHead>
            <TableHead className="font-semibold">Saatler</TableHead>
            <TableHead className="font-semibold">Günler</TableHead>
            <TableHead className="font-semibold">Durum</TableHead>
            <TableHead className="font-semibold text-right">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules?.map((rule) => (
            <TableRow key={rule.id} className="group">
              <TableCell className="font-medium">{rule.type}</TableCell>
              <TableCell>
                {rule.employees ? (
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                    Tüm Personel
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">
                    Departman
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline" 
                  className="bg-orange-100 text-orange-800 hover:bg-orange-200"
                >
                  {rule.devices?.name || '2 Kapı / 1 Bölge'}
                </Badge>
              </TableCell>
              <TableCell>
                {rule.start_time} - {rule.end_time}
              </TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {rule.days.map((day) => (
                    <Badge key={day} variant="outline" className="bg-gray-100">
                      {day}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Switch 
                  checked={rule.is_active} 
                  className="data-[state=checked]:bg-green-500"
                />
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-gray-700"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default UnifiedRuleTable;
