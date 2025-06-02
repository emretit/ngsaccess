
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useAccessRules } from "@/hooks/useAccessRules";
import { Loader2, Plus } from "lucide-react";

interface AccessRulesListProps {
  onCreateRule: () => void;
}

const AccessRulesList = ({ onCreateRule }: AccessRulesListProps) => {
  const { rules, isLoading, toggleRule, isToggling } = useAccessRules();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Yükleniyor...</span>
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔐</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Henüz erişim kuralı yok
        </h3>
        <p className="text-gray-600 mb-4">
          İlk erişim kuralınızı oluşturmak için başlayın.
        </p>
        <Button onClick={onCreateRule}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Kural
        </Button>
      </div>
    );
  }

  const formatDays = (days: string[]) => {
    const dayMap: Record<string, string> = {
      'Monday': 'Pzt',
      'Tuesday': 'Sal',
      'Wednesday': 'Çar',
      'Thursday': 'Per',
      'Friday': 'Cum',
      'Saturday': 'Cmt',
      'Sunday': 'Paz'
    };
    return days.map(day => dayMap[day] || day).join(', ');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Erişim Kuralları</h2>
        <Button onClick={onCreateRule}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Kural
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kural Adı</TableHead>
            <TableHead>Çalışan</TableHead>
            <TableHead>Cihaz</TableHead>
            <TableHead>Saat Aralığı</TableHead>
            <TableHead>Günler</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Aktif</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule: any) => (
            <TableRow key={rule.id}>
              <TableCell className="font-medium">{rule.name}</TableCell>
              <TableCell>
                {rule.employees 
                  ? `${rule.employees.first_name} ${rule.employees.last_name}`
                  : 'Tüm çalışanlar'
                }
              </TableCell>
              <TableCell>
                {rule.devices 
                  ? `${rule.devices.name} (${rule.devices.location})`
                  : 'Tüm cihazlar'
                }
              </TableCell>
              <TableCell>
                {rule.start_time && rule.end_time 
                  ? `${rule.start_time} - ${rule.end_time}`
                  : '24 saat'
                }
              </TableCell>
              <TableCell>
                <span className="text-sm text-gray-600">
                  {formatDays(rule.days || [])}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={rule.is_active ? "default" : "secondary"}>
                  {rule.is_active ? 'Aktif' : 'Pasif'}
                </Badge>
              </TableCell>
              <TableCell>
                <Switch
                  checked={rule.is_active}
                  onCheckedChange={(checked) => 
                    toggleRule({ id: rule.id, is_active: checked })
                  }
                  disabled={isToggling}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default AccessRulesList;
