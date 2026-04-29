
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type FormFieldProps = {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  pattern?: string;
  title?: string;
  maxLength?: number;
};

export function FormTextField({ 
  label, 
  name,
  type = "text",
  value,
  onChange,
  required,
  className,
  pattern,
  title,
  maxLength
}: FormFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        type={type}
        id={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={className}
        required={required}
        pattern={pattern}
        title={title}
        maxLength={maxLength}
      />
    </div>
  );
}

type SelectOption = {
  id: string | number;
  name: string;
};

type SelectFieldProps = {
  label: string;
  name: string;
  value: string | boolean;
  onChange: (value: string) => void;
  options: SelectOption[];
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
};

export function FormSelectField({
  label,
  name,
  value,
  onChange,
  options,
  required,
  placeholder = "Seçiniz",
  disabled
}: SelectFieldProps) {
  // "Durum" alanı için özel eşleştirme
  const getDisplayValue = () => {
    if (name === 'is_active' || name === 'isActive') {
      if (value === 'active' || value === 'true' || value === true) return 'active';
      if (value === 'inactive' || value === 'false' || value === false) return 'inactive';
      return String(value);
    }
    return String(value);
  };

  const getDisplayOptions = () => {
    if (name === 'is_active' || name === 'isActive') {
      return [
        { id: 'active', name: 'Aktif' },
        { id: 'inactive', name: 'Pasif' }
      ];
    }
    return options;
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Select value={getDisplayValue()} onValueChange={onChange} required={required} disabled={disabled}>
        <SelectTrigger id={name}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {getDisplayOptions().map(option => (
            <SelectItem 
              key={typeof option.id === 'string' ? option.id : option.id.toString()} 
              value={typeof option.id === 'string' ? option.id : option.id.toString()}
            >
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FormTextArea({
  label,
  name,
  value,
  onChange,
  className
}: FormFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Textarea
        id={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={className}
        rows={4}
      />
    </div>
  );
}
