
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { EmployeeFormData } from './hooks/useEmployeeFormData';
import type { Id } from '../../../convex/_generated/dataModel';

interface EmployeeFormFieldsProps {
  formData: EmployeeFormData;
  setFormData: (data: EmployeeFormData) => void;
  companies: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  accessRules: { id: string; name: string }[];
  positions: { id: string; name: string }[];
}

export default function EmployeeFormFields({
  formData,
  setFormData,
  companies,
  departments,
  accessRules,
  positions,
}: EmployeeFormFieldsProps) {
  const handleInputChange = <K extends keyof EmployeeFormData>(field: K, value: EmployeeFormData[K]) => {
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
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="last_name">Soyad *</Label>
          <Input
            id="last_name"
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
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
            value={formData.tcNo}
            onChange={(e) => handleInputChange('tcNo', e.target.value)}
            maxLength={11}
            required
          />
        </div>

        <div>
          <Label htmlFor="card_number">Kart Numarası *</Label>
          <Input
            id="card_number"
            value={formData.cardNumber}
            onChange={(e) => handleInputChange('cardNumber', e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="payroll_code">Bordro Kodu</Label>
          <Input
            id="payroll_code"
            value={formData.payrollCode}
            onChange={(e) => handleInputChange('payrollCode', e.target.value)}
            placeholder="Bordro yazılımındaki personel kodu"
          />
        </div>
      </div>

      {/* Work Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">İş Bilgileri</h3>

        <div>
          <Label htmlFor="company_id">Şirket</Label>
          <Select
            value={formData.companyId ?? ''}
            onValueChange={(value) => handleInputChange('companyId', (value || null) as Id<'companies'> | null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Şirket seçin" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="department_id">Departman</Label>
          <Select
            value={formData.departmentId ?? ''}
            onValueChange={(value) => handleInputChange('departmentId', (value || null) as Id<'departments'> | null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Departman seçin" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="position_id">Pozisyon</Label>
          <Select
            value={formData.positionId ?? ''}
            onValueChange={(value) => handleInputChange('positionId', (value || null) as Id<'positions'> | null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pozisyon seçin" />
            </SelectTrigger>
            <SelectContent>
              {positions.map((position) => (
                <SelectItem key={position.id} value={position.id}>
                  {position.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="access_rule_id">Erişim Kuralı</Label>
          <Select
            value={formData.accessRuleId ?? ''}
            onValueChange={(value) => handleInputChange('accessRuleId', (value || null) as Id<'accessRules'> | null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Erişim kuralı seçin" />
            </SelectTrigger>
            <SelectContent>
              {accessRules.map((rule) => (
                <SelectItem key={rule.id} value={rule.id}>
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

        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_active"
            checked={formData.isActive}
            onCheckedChange={(checked) => handleInputChange('isActive', checked === true)}
          />
          <Label htmlFor="is_active">Aktif</Label>
        </div>
      </div>
    </div>
  );
}
