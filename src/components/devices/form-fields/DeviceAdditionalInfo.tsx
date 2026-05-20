
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { parseDateString, formatDateString } from "@/lib/date";

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
        <Label htmlFor="expiry_date">Son Kullanma Tarihi</Label>
        <DatePicker
          date={parseDateString(expiryDate)}
          onSelect={(d) => onExpiryDateChange(formatDateString(d))}
          placeholder="Tarih seçin (opsiyonel)"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Eğer cihazın bir son kullanma tarihi varsa belirtin, yoksa boş bırakın.
        </p>
      </div>
    </>
  );
}
