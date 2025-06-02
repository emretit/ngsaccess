
import { useAccessRules } from "@/hooks/useAccessRules";
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
import { Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const UnifiedRuleTable = () => {
  const { rules, isLoading, toggleRule, isToggling } = useAccessRules();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Yükleniyor...</span>
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📋</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Henüz kural bulunmuyor
        </h3>
        <p className="text-gray-600">
          İlk erişim kuralınızı oluşturmak için "Yeni Kural" butonuna tıklayın.
        </p>
      </div>
    );
  }

  const handleToggleRule = (id: number, currentStatus: boolean) => {
    toggleRule({ id, is_active: !currentStatus });
  };

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
          {rules.map((rule) => (
            <TableRow key={rule.id} className="group">
              <TableCell className="font-medium">
                <div>
                  <div className="font-semibold">{rule.name}</div>
                  {rule.description && (
                    <div className="text-sm text-gray-500 mt-1">
                      {rule.description}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {rule.departments.map((dept) => (
                    <Badge 
                      key={`dept-${dept.id}`}
                      variant="outline" 
                      className="bg-blue-100 text-blue-800 hover:bg-blue-200"
                    >
                      Dept: {dept.name}
                    </Badge>
                  ))}
                  {rule.employees.map((emp) => (
                    <Badge 
                      key={`emp-${emp.id}`}
                      variant="outline" 
                      className="bg-green-100 text-green-800 hover:bg-green-200"
                    >
                      {emp.name}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {rule.zones.map((zone) => (
                    <Badge 
                      key={`zone-${zone.id}`}
                      variant="outline" 
                      className="bg-purple-100 text-purple-800 hover:bg-purple-200"
                    >
                      Zone: {zone.name}
                    </Badge>
                  ))}
                  {rule.doors.map((door) => (
                    <Badge 
                      key={`door-${door.id}`}
                      variant="outline" 
                      className="bg-orange-100 text-orange-800 hover:bg-orange-200"
                    >
                      {door.name}
                    </Badge>
                  ))}
                </div>
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
                  onCheckedChange={(checked) => handleToggleRule(rule.id, rule.is_active)}
                  className="data-[state=checked]:bg-green-500"
                  disabled={isToggling}
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
