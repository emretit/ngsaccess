
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="grid grid-cols-1 gap-4">
      <div className="space-y-2">
        <Label htmlFor="name">Kural Adı</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Erişim kuralı adı"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Açıklama</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Kural açıklaması (opsiyonel)"
          rows={3}
        />
      </div>
    </div>
  );
};
