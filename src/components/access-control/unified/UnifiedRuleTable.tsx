
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
import { format } from "date-fns";
import { tr } from "date-fns/locale";

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Kural Tipi</TableHead>
          <TableHead>Çalışan</TableHead>
          <TableHead>Cihaz</TableHead>
          <TableHead>Günler</TableHead>
          <TableHead>Saat Aralığı</TableHead>
          <TableHead>Durum</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules?.map((rule) => (
          <TableRow key={rule.id}>
            <TableCell className="font-medium">{rule.type}</TableCell>
            <TableCell>
              {rule.employees 
                ? `${rule.employees.first_name} ${rule.employees.last_name}`
                : '-'}
            </TableCell>
            <TableCell>{rule.devices?.name || '-'}</TableCell>
            <TableCell>
              <div className="flex gap-1 flex-wrap">
                {rule.days.map((day) => (
                  <Badge key={day} variant="outline">
                    {day}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>
              {rule.start_time} - {rule.end_time}
            </TableCell>
            <TableCell>
              <Badge 
                variant={rule.is_active ? "success" : "secondary"}
              >
                {rule.is_active ? 'Aktif' : 'Pasif'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default UnifiedRuleTable;
