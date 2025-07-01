
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Clock, 
  Users, 
  Shield, 
  Plus, 
  Edit, 
  Trash2,
  Filter,
  Search
} from "lucide-react";
import { useShiftBasedAccessRules, useShifts, ShiftBasedAccessRule } from "@/hooks/useShiftBasedAccessRules";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ShiftBasedAccessRulesProps {
  onCreateRule: () => void;
  onEditRule: (rule: ShiftBasedAccessRule) => void;
}

const ShiftBasedAccessRules = ({ onCreateRule, onEditRule }: ShiftBasedAccessRulesProps) => {
  const { projectIds } = useProjectAccess();
  const { data: rules = [], isLoading } = useShiftBasedAccessRules(projectIds?.[0]);
  const { data: shifts = [] } = useShifts(projectIds?.[0]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const filteredRules = rules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) 
      || rule.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesShift = selectedShift === 'all' 
      || (selectedShift === 'no-shift' && !rule.is_shift_based)
      || rule.shift_id?.toString() === selectedShift;
    
    const matchesStatus = selectedStatus === 'all' 
      || (selectedStatus === 'active' && rule.is_active)
      || (selectedStatus === 'inactive' && !rule.is_active);

    return matchesSearch && matchesShift && matchesStatus;
  });

  const getAccessTimeDisplay = (rule: ShiftBasedAccessRule) => {
    if (rule.is_shift_based && rule.shift_start_time && rule.shift_end_time) {
      return `${rule.shift_start_time} - ${rule.shift_end_time} (Vardiya)`;
    }
    if (rule.start_time && rule.end_time) {
      return `${rule.start_time} - ${rule.end_time}`;
    }
    return '24/7';
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 900) return 'bg-red-100 text-red-800';
    if (priority >= 700) return 'bg-orange-100 text-orange-800';
    if (priority >= 500) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  if (isLoading) {
    return <LoadingSpinner text="Vardiya bazlı erişim kuralları yükleniyor..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vardiya Bazlı Erişim Kuralları</h2>
          <p className="text-gray-600 mt-1">
            Çalışan vardiyalarına göre erişim kurallarını yönetin
          </p>
        </div>
        <Button onClick={onCreateRule} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Yeni Kural
        </Button>
      </div>

      {/* Filtreler */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtreler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Kural ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger>
                <SelectValue placeholder="Vardiya seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kurallar</SelectItem>
                <SelectItem value="no-shift">Vardiyasız Kurallar</SelectItem>
                {shifts.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id.toString()}>
                    {shift.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Durum seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Pasif</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {filteredRules.length} kural
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kurallar Tablosu */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kural Adı</TableHead>
                <TableHead>Vardiya</TableHead>
                <TableHead>Erişim Zamanı</TableHead>
                <TableHead>Hedef</TableHead>
                <TableHead>Yön</TableHead>
                <TableHead>Öncelik</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                    <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">Henüz kural bulunamadı</p>
                    <p className="text-sm">Yeni bir erişim kuralı oluşturmak için yukarıdaki butona tıklayın</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{rule.name}</div>
                        {rule.description && (
                          <div className="text-sm text-gray-500 mt-1">
                            {rule.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {rule.is_shift_based ? (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">
                            {rule.shift_name}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline">Manuel Zaman</Badge>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        {getAccessTimeDisplay(rule)}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-green-500" />
                        <span className="text-sm">
                          {rule.target_type === 'all' ? 'Tüm Çalışanlar' :
                           rule.target_type === 'department' ? 'Departman' :
                           rule.target_type === 'individual' ? 'Bireysel' : 'Pozisyon'}
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant="outline">
                        {rule.access_direction === 'both' ? 'Giriş & Çıkış' :
                         rule.access_direction === 'entry' ? 'Sadece Giriş' : 'Sadece Çıkış'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Badge className={getPriorityColor(rule.priority)}>
                        {rule.priority}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditRule(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShiftBasedAccessRules;
