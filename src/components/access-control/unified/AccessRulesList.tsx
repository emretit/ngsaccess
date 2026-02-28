
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAccessRules } from "@/hooks/useAccessRules";
import { Loader2, Plus, Users, Monitor, ChevronDown, ChevronUp, Edit, Trash2, Clock, Calendar } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLocationUtils } from "@/hooks/useLocationUtils";
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
  const { rules, isLoading, error, updateAccessRule, deleteAccessRule, isDeleting } = useAccessRules();
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const { getDeviceLocationDisplay } = useLocationUtils();

  const toggleExpanded = (ruleId: string) => {
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

  const handleDeleteRule = (ruleId: string) => {
    deleteAccessRule.mutate(ruleId as any);
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

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">&#x26a0;&#xfe0f;</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Hata Oluştu
        </h3>
        <p className="text-gray-600 mb-4">
          Erişim kuralları yüklenirken bir hata oluştu: {error.message}
        </p>
        <Button onClick={() => window.location.reload()}>
          Yeniden Dene
        </Button>
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">&#x1f510;</span>
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
    const employees = rule.group_members?.map((gm: any) => gm.employees).filter(Boolean) || [];

    if (employees.length === 0) {
      return (
        <div className="flex items-center gap-2 text-gray-500">
          <Users className="h-4 w-4" />
          <span className="text-sm">Çalışan seçilmemiş</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-blue-500" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{employees.length} çalışan</span>
          <span className="text-xs text-gray-500">
            {employees.slice(0, 2).map((emp: any) => `${emp.first_name} ${emp.last_name}`).join(', ')}
            {employees.length > 2 && ` +${employees.length - 2} diğer`}
          </span>
        </div>
      </div>
    );
  };

  const renderDevices = (rule: any) => {
    const devices = rule.group_devices?.map((gd: any) => gd.devices).filter(Boolean) || [];

    if (devices.length === 0) {
      return (
        <div className="flex items-center gap-2 text-gray-500">
          <Monitor className="h-4 w-4" />
          <span className="text-sm">Cihaz seçilmemiş</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-green-500" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{devices.length} cihaz</span>
          <span className="text-xs text-gray-500">
            {devices.slice(0, 2).map((device: any) => device.name).join(', ')}
            {devices.length > 2 && ` +${devices.length - 2} diğer`}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Erişim Kuralları</h2>
          <p className="text-gray-600 mt-1">Çalışan erişim kurallarını yönetin ve düzenleyin</p>
        </div>
        <Button onClick={onCreateRule} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Yeni Kural
        </Button>
      </div>

      <div className="space-y-4">
        {rules.map((rule: any) => {
          const ruleId = String(rule._id);
          return (
            <Card key={ruleId} className="border border-gray-200 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                      <Badge variant={rule.isActive ? "default" : "secondary"}>
                        {rule.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.isActive ?? true}
                      onCheckedChange={(checked) =>
                        updateAccessRule.mutate({ id: rule._id, updates: { isActive: checked } })
                      }
                      disabled={updateAccessRule.isPending}
                    />

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
                            onClick={() => handleDeleteRule(ruleId)}
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

                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(ruleId)}
                          className="h-8 w-8 p-0"
                        >
                          {expandedRules.has(ruleId) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </Collapsible>
                  </div>
                </div>

                {rule.description && (
                  <p className="text-sm text-gray-600 mt-2">{rule.description}</p>
                )}
              </CardHeader>

              <CardContent className="pt-0">
                {/* Quick Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <div>
                      <span className="text-sm font-medium">Zaman</span>
                      <p className="text-xs text-gray-500">
                        {rule.startTime && rule.endTime
                          ? `${rule.startTime} - ${rule.endTime}`
                          : '24 saat'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <div>
                      <span className="text-sm font-medium">Günler</span>
                      <p className="text-xs text-gray-500">
                        {formatDays(rule.days || [])}
                      </p>
                    </div>
                  </div>

                  <div>{renderEmployees(rule)}</div>
                  <div>{renderDevices(rule)}</div>
                </div>

                {/* Expandable Details */}
                <Collapsible open={expandedRules.has(ruleId)}>
                  <CollapsibleContent>
                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Çalışanlar</h4>
                          <div className="space-y-2">
                            {rule.group_members?.length > 0 ? (
                              rule.group_members.map((gm: any, index: number) => (
                                <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                                  <Users className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm">{gm.employees?.first_name} {gm.employees?.last_name}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500 italic">Çalışan seçilmemiş</div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Cihazlar</h4>
                          <div className="space-y-2">
                            {rule.group_devices?.length > 0 ? (
                              rule.group_devices.map((gd: any, index: number) => (
                                <div key={index} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                                  <Monitor className="h-4 w-4 text-green-500" />
                                  <div>
                                    <span className="text-sm font-medium">{gd.devices?.name}</span>
                                    <p className="text-xs text-gray-500">
                                      {gd.devices ? getDeviceLocationDisplay({
                                        zoneId: gd.devices.zone_id,
                                        doorId: gd.devices.door_id,
                                      }) : 'Konum Bilinmiyor'}
                                    </p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500 italic">Cihaz seçilmemiş</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AccessRulesList;
