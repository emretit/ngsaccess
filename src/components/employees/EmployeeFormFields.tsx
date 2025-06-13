
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { EmployeeFormData } from './hooks/useEmployeeFormData';

interface EmployeeFormFieldsProps {
  formData: EmployeeFormData;
  setFormData: (data: EmployeeFormData) => void;
  companies: { id: number; name: string }[];
  departments: { id: number; name: string }[];
  accessRules: { id: number; name: string }[];
  positions: { id: number; name: string }[];
}

export default function EmployeeFormFields({
  formData,
  setFormData,
  companies,
  departments,
  accessRules,
  positions,
}: EmployeeFormFieldsProps) {
  const handleInputChange = (field: keyof EmployeeFormData, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Kişisel Bilgiler</h3>
        
        <div>
          <Label htmlFor="first_name">Ad *</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(e) => handleInputChange('first_name', e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="last_name">Soyad *</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(e) => handleInputChange('last_name', e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="email">E-posta *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="tc_no">TC Kimlik No *</Label>
          <Input
            id="tc_no"
            value={formData.tc_no}
            onChange={(e) => handleInputChange('tc_no', e.target.value)}
            maxLength={11}
            required
          />
        </div>

        <div>
          <Label htmlFor="card_number">Kart Numarası *</Label>
          <Input
            id="card_number"
            value={formData.card_number}
            onChange={(e) => handleInputChange('card_number', e.target.value)}
            required
          />
        </div>
      </div>

      {/* Work Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">İş Bilgileri</h3>

        <div>
          <Label htmlFor="company_id">Şirket</Label>
          <Select
            value={formData.company_id?.toString() || ''}
            onValueChange={(value) => handleInputChange('company_id', value ? parseInt(value) : null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Şirket seçin" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id.toString()}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="department_id">Departman</Label>
          <Select
            value={formData.department_id?.toString() || ''}
            onValueChange={(value) => handleInputChange('department_id', value ? parseInt(value) : null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Departman seçin" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id.toString()}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="position_id">Pozisyon</Label>
          <Select
            value={formData.position_id?.toString() || ''}
            onValueChange={(value) => handleInputChange('position_id', value ? parseInt(value) : null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pozisyon seçin" />
            </SelectTrigger>
            <SelectContent>
              {positions.map((position) => (
                <SelectItem key={position.id} value={position.id.toString()}>
                  {position.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="access_rule_id">Erişim Kuralı</Label>
          <Select
            value={formData.access_rule_id?.toString() || ''}
            onValueChange={(value) => handleInputChange('access_rule_id', value ? parseInt(value) : null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Erişim kuralı seçin" />
            </SelectTrigger>
            <SelectContent>
              {accessRules.map((rule) => (
                <SelectItem key={rule.id} value={rule.id.toString()}>
                  {rule.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="shift">Vardiya</Label>
          <Input
            id="shift"
            value={formData.shift || ''}
            onChange={(e) => handleInputChange('shift', e.target.value)}
            placeholder="Vardiya bilgisi"
          />
        </div>

        <div>
          <Label htmlFor="notes">Notlar</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Ek notlar..."
            rows={3}
          />
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange('is_active', checked)}
            />
            <Label htmlFor="is_active">Aktif</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="access_permission"
              checked={formData.access_permission}
              onCheckedChange={(checked) => handleInputChange('access_permission', checked)}
            />
            <Label htmlFor="access_permission">Erişim İzni</Label>
          </div>
        </div>
      </div>
    </div>
  );
}
