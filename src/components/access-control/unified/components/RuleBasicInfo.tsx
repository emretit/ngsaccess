import { Input } from "@/components/ui/input";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";

interface RuleBasicInfoFormData {
  name: string;
  description: string;
}

interface RuleBasicInfoProps<
  T extends RuleBasicInfoFormData = RuleBasicInfoFormData,
> {
  errors?: Record<string, string>;
  formData: T;
  setFormData: (updater: (prev: T) => T) => void;
}

export const RuleBasicInfo = <T extends RuleBasicInfoFormData>({
  formData,
  setFormData,
  errors = {},
}: RuleBasicInfoProps<T>) => {
  return (
    <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
      <FormFieldWrapper htmlFor="name" label="Kural Adı" error={errors.name}>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="Erişim kuralı adı"
          required
        />
      </FormFieldWrapper>

      <details>
        <summary className="cursor-pointer text-sm min-h-11 md:min-h-0">
          Açıklama ekle
        </summary>
        <FormFieldWrapper htmlFor="description" label="Açıklama">
          <Input
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Kural açıklaması (opsiyonel)"
          />
        </FormFieldWrapper>
      </details>
    </div>
  );
};
