
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
import { Loader2, Plus, Users, Monitor, ChevronDown, ChevronUp, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AccessRulesListProps {
  onCreateRule: () => void;
  onEditRule?: (rule: any) => void;
}

const AccessRulesList = ({ onCreateRule, onEditRule }: AccessRulesListProps) => {
  const { rules, isLoading, toggleRule, isToggling, deleteRule, isDeleting } = useAccessRules();
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set());

  const toggleExpanded = (ruleId: number) => {
    setExpandedRules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  };

  const handleDeleteRule = (ruleId: number) => {
    deleteRule(ruleId);
  };

  const handleEditRule = (rule: any) => {
    if (onEditRule) {
      onEditRule(rule);
    }
  };

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

  const renderEmployees = (rule: any) => {
    // Always get employees from junction table relations
    const employees = rule.rule_employees?.map((re: any) => re.employees).filter(Boolean) || [];
    
    if (employees.length === 0) {
      return (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" />
          <span className="text-sm text-gray-500">Çalışan seçilmemiş</span>
        </div>
      );
    }

    if (employees.length === 1) {
      return (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" />
          <span className="text-sm">{employees[0].first_name} {employees[0].last_name}</span>
        </div>
      );
    }

    const firstEmployee = employees[0];
    return (
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-blue-500" />
        <div className="flex flex-col">
          <span className="text-sm">{firstEmployee.first_name} {firstEmployee.last_name}</span>
          <Badge variant="secondary" className="text-xs mt-1 w-fit">
            +{employees.length - 1} diğer çalışan
          </Badge>
        </div>
      </div>
    );
  };

  const renderDevices = (rule: any) => {
    // Always get devices from junction table relations
    const devices = rule.rule_devices?.map((rd: any) => rd.devices).filter(Boolean) || [];
    
    if (devices.length === 0) {
      return (
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-green-500" />
          <span className="text-sm text-gray-500">Cihaz seçilmemiş</span>
        </div>
      );
    }

    if (devices.length === 1) {
      return (
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-green-500" />
          <span className="text-sm">{devices[0].name}</span>
        </div>
      );
    }

    const firstDevice = devices[0];
    return (
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-green-500" />
        <div className="flex flex-col">
          <span className="text-sm">{firstDevice.name}</span>
          <Badge variant="secondary" className="text-xs mt-1 w-fit">
            +{devices.length - 1} diğer cihaz
          </Badge>
        </div>
      </div>
    );
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

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Kural Adı</TableHead>
              <TableHead>Çalışanlar</TableHead>
              <TableHead>Cihazlar</TableHead>
              <TableHead>Saat Aralığı</TableHead>
              <TableHead>Günler</TableHead>
              <TableHead>Aktif</TableHead>
              <TableHead className="w-24">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule: any) => (
              <>
                <TableRow key={rule.id} className="group">
                  <TableCell>
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(rule.id)}
                          className="p-1 h-8 w-8"
                        >
                          {expandedRules.has(rule.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </Collapsible>
                  </TableCell>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{renderEmployees(rule)}</TableCell>
                  <TableCell>{renderDevices(rule)}</TableCell>
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
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => 
                        toggleRule({ id: rule.id, is_active: checked })
                      }
                      disabled={isToggling}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditRule(rule)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Kuralı Sil</AlertDialogTitle>
                            <AlertDialogDescription>
                              Bu erişim kuralını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteRule(rule.id)}
                              disabled={isDeleting}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isDeleting ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Siliniyor...
                                </>
                              ) : (
                                'Sil'
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
                
                {expandedRules.has(rule.id) && (
                  <TableRow>
                    <TableCell></TableCell>
                    <TableCell colSpan={7}>
                      <Collapsible open={expandedRules.has(rule.id)}>
                        <CollapsibleContent>
                          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                            {rule.description && (
                              <div>
                                <span className="text-sm font-medium text-gray-700">Açıklama:</span>
                                <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-sm font-medium text-gray-700">Çalışanlar:</span>
                                <div className="mt-1 space-y-1">
                                  {rule.rule_employees?.length > 0 ? (
                                    rule.rule_employees.map((re: any, index: number) => (
                                      <div key={index} className="text-sm text-gray-600">
                                        • {re.employees?.first_name} {re.employees?.last_name}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm text-gray-500">Çalışan seçilmemiş</div>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <span className="text-sm font-medium text-gray-700">Cihazlar:</span>
                                <div className="mt-1 space-y-1">
                                  {rule.rule_devices?.length > 0 ? (
                                    rule.rule_devices.map((rd: any, index: number) => (
                                      <div key={index} className="text-sm text-gray-600">
                                        • {rd.devices?.name} ({rd.devices?.location})
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm text-gray-500">Cihaz seçilmemiş</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AccessRulesList;
