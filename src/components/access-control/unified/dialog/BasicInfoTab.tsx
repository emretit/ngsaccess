import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AccessDirection,
  EnhancedRuleFormData,
  TargetType,
} from "./useEnhancedRuleForm";

interface BasicInfoTabProps {
  formData: EnhancedRuleFormData;
  setFormData: Dispatch<SetStateAction<EnhancedRuleFormData>>;
}

export function BasicInfoTab({ formData, setFormData }: BasicInfoTabProps) {
  const handleTargetTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      targetType: value as TargetType,
      selectedEmployees: value === "all" ? [] : prev.selectedEmployees,
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-5 w-5" />
          <span>Kural Detayları</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Kural Adı *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Erişim kuralı adı"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Öncelik</Label>
            <Input
              id="priority"
              type="number"
              value={formData.priority}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  priority: parseInt(e.target.value) || 100,
                }))
              }
              placeholder="100"
              min="1"
              max="1000"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Açıklama</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Kural açıklaması (opsiyonel)"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="target_type">Hedef Türü</Label>
          <Select value={formData.targetType} onValueChange={handleTargetTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Hedef türünü seçin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Bireysel Çalışan</SelectItem>
              <SelectItem value="department">Departman</SelectItem>
              <SelectItem value="all">Tüm Çalışanlar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="access_direction">Erişim Yönü</Label>
          <Select
            value={formData.accessDirection}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                accessDirection: value as AccessDirection,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Erişim yönünü seçin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Giriş & Çıkış</SelectItem>
              <SelectItem value="entry">Sadece Giriş</SelectItem>
              <SelectItem value="exit">Sadece Çıkış</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
