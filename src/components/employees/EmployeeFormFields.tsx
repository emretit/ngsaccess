
import { FormTextField, FormSelectField, FormTextArea } from './FormFields';
import { EmployeeFormData } from './hooks/useEmployeeFormData';

interface EmployeeFormFieldsProps {
  formData: EmployeeFormData;
  setFormData: (data: EmployeeFormData) => void;
  companies: { id: number; name: string }[];
  departments: { id: number; name: string }[];
  accessRules: { id: number; name: string }[];
  positions?: { id: number; name: string }[];
}

export default function EmployeeFormFields({
  formData,
  setFormData,
  companies,
  departments,
  accessRules,
  positions = []
}: EmployeeFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormTextField
          label="Ad"
          name="first_name"
          value={formData.first_name || ''}
          onChange={(value) => setFormData({ ...formData, first_name: value })}
          required
        />
        <FormTextField
          label="Soyad"
          name="last_name"
          value={formData.last_name || ''}
          onChange={(value) => setFormData({ ...formData, last_name: value })}
          required
        />
      </div>

      <FormTextField
        label="TC Kimlik No"
        name="tc_no"
        value={formData.tc_no || ''}
        onChange={(value) => setFormData({ ...formData, tc_no: value })}
        maxLength={11}
        pattern="[0-9]{11}"
        title="TC Kimlik No 11 haneli rakamlardan oluşmalıdır"
        required
      />

      <FormTextField
        label="E-posta"
        name="email"
        type="email"
        value={formData.email || ''}
        onChange={(value) => setFormData({ ...formData, email: value })}
        required
      />

      <FormSelectField
        label="Şirket"
        name="company_id"
        value={formData.company_id?.toString() || ''}
        onChange={(value) => setFormData({ ...formData, company_id: parseInt(value) || null })}
        options={companies}
      />

      <FormSelectField
        label="Departman"
        name="department"
        value={formData.department_id?.toString() || formData.department || ''}
        onChange={(value) => {
          // ID olarak kaydet ama gösterim için isim de sakla
          const selectedDept = departments.find(d => d.id.toString() === value);
          setFormData({ 
            ...formData, 
            department_id: parseInt(value) || null,
            department: selectedDept ? selectedDept.name : value
          });
        }}
        options={departments}
        required
      />

      <FormSelectField
        label="Pozisyon"
        name="position"
        value={formData.position_id?.toString() || formData.position || ''}
        onChange={(value) => {
          // ID olarak kaydet ama gösterim için isim de sakla
          const selectedPos = positions.find(p => p.id.toString() === value);
          setFormData({ 
            ...formData, 
            position_id: parseInt(value) || null,
            position: selectedPos ? selectedPos.name : value
          });
        }}
        options={positions}
        required
      />

      <FormSelectField
        label="Erişim Kuralı"
        name="access_rule"
        value={formData.access_rule_id?.toString() || ''}
        onChange={(value) => {
          const selectedRule = accessRules.find(r => r.id.toString() === value);
          setFormData({ 
            ...formData, 
            access_rule_id: parseInt(value) || null,
            access_rule: selectedRule ? selectedRule.name : ''
          });
        }}
        options={accessRules}
        placeholder="Erişim kuralı seçiniz"
      />

      <FormTextField
        label="Kart No"
        name="card_number"
        value={formData.card_number || ''}
        onChange={(value) => setFormData({ ...formData, card_number: value })}
        required
      />

      <FormSelectField
        label="Durum"
        name="is_active"
        value={formData.is_active ? 'active' : 'inactive'}
        onChange={(value) => setFormData({ ...formData, is_active: value === 'active' })}
        options={[
          { id: 'active', name: 'Aktif' },
          { id: 'inactive', name: 'Pasif' }
        ]}
        required
      />

      <FormTextArea
        label="Açıklama / Notlar"
        name="notes"
        value={formData.notes || ''}
        onChange={(value) => setFormData({ ...formData, notes: value })}
        className="min-h-[80px]"
      />
    </div>
  );
}
