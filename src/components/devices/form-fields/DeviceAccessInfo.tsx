
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AccessDirection } from "@/types/device";

interface DeviceAccessInfoProps {
  accessDirection: AccessDirection;
  onAccessDirectionChange: (value: AccessDirection) => void;
  disabled?: boolean;
}

export function DeviceAccessInfo({
  accessDirection,
  onAccessDirectionChange,
  disabled = false
}: DeviceAccessInfoProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-medium">Erişim Yönü</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Bu cihazın hangi yönde erişim kontrolü yapacağını belirleyin
        </p>
        
        <RadioGroup
          value={accessDirection}
          onValueChange={(value) => onAccessDirectionChange(value as AccessDirection)}
          disabled={disabled}
          className="space-y-3"
        >
          <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="entry" id="entry" />
            <div className="flex-1">
              <Label htmlFor="entry" className="font-medium cursor-pointer">
                Giriş
              </Label>
              <p className="text-sm text-muted-foreground">
                Sadece giriş kontrolü yapar
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="exit" id="exit" />
            <div className="flex-1">
              <Label htmlFor="exit" className="font-medium cursor-pointer">
                Çıkış
              </Label>
              <p className="text-sm text-muted-foreground">
                Sadece çıkış kontrolü yapar
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="both" id="both" />
            <div className="flex-1">
              <Label htmlFor="both" className="font-medium cursor-pointer">
                Her İkisi
              </Label>
              <p className="text-sm text-muted-foreground">
                Hem giriş hem çıkış kontrolü yapar
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
