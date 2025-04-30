
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DeviceAdditionalInfoProps {
  description: string;
  onDescriptionChange: (value: string) => void;
  expiryDate: string;
  onExpiryDateChange: (value: string) => void;
}

export function DeviceAdditionalInfo({
  description,
  onDescriptionChange,
  expiryDate,
  onExpiryDateChange
}: DeviceAdditionalInfoProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="description">Açıklama</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Cihaz hakkında detaylı bilgi giriniz..."
          className="resize-none h-24"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="expiry_date" className="text-sm font-medium">
          Son Kullanma Tarihi
        </label>
        <Input
          id="expiry_date"
          type="date"
          value={expiryDate}
          onChange={(e) => onExpiryDateChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Eğer cihazın bir son kullanma tarihi varsa belirtin, yoksa boş bırakın.
        </p>
      </div>
    </>
  );
}
