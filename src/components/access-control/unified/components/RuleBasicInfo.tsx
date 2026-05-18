import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RuleBasicInfoFormData {
  name: string;
  description: string;
}

interface RuleBasicInfoProps<T extends RuleBasicInfoFormData = RuleBasicInfoFormData> {
  formData: T;
  setFormData: (updater: (prev: T) => T) => void;
}

export const RuleBasicInfo = <T extends RuleBasicInfoFormData,>({ formData, setFormData }: RuleBasicInfoProps<T>) => {
  return (
    <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="name">Kural Adı</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Erişim kuralı adı"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Açıklama</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Kural açıklaması (opsiyonel)"
        />
      </div>
    </div>
  );
};
