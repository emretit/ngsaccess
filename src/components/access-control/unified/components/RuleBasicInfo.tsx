import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <div className="space-y-1.5">
        <Label htmlFor="name">Kural Adı</Label>
        <Input
          id="name"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "rule-name-error" : undefined}
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="Erişim kuralı adı"
          required
        />
        {errors.name && (
          <p id="rule-name-error" role="alert" className="text-danger text-xs">
            {errors.name}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Açıklama</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Kural açıklaması (opsiyonel)"
        />
      </div>
    </div>
  );
};
