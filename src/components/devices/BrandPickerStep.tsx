import { Button } from "@/components/ui/button";
import { Cpu, Wifi } from "lucide-react";
import type { DeviceBrand } from "./hooks/useDeviceFormSchema";
import { BRAND_LABELS } from "./hooks/useDeviceFormSchema";

interface BrandPickerStepProps {
  onSelect: (brand: DeviceBrand) => void;
  onCancel: () => void;
}

interface BrandOption {
  value: DeviceBrand;
  description: string;
  Icon: typeof Cpu;
  iconClass: string;
}

const OPTIONS: BrandOption[] = [
  {
    value: "hikvision",
    description: "Erişim terminali / yüz tanıma — Device Gateway (ISUP 5.0) üzerinden",
    Icon: Cpu,
    iconClass: "text-red-600",
  },
  {
    value: "other",
    description: "ESP32, QR okuyucu, jenerik cihaz — HTTP push ile event gönderir",
    Icon: Wifi,
    iconClass: "text-blue-600",
  },
];

export function BrandPickerStep({ onSelect, onCancel }: BrandPickerStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold mb-1">Marka Seçin</h3>
        <p className="text-sm text-muted-foreground">
          Cihazınızın markasına göre kurulum adımları farklılaşır.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {OPTIONS.map(({ value, description, Icon, iconClass }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className="group flex flex-col items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent"
          >
            <Icon className={`w-8 h-8 ${iconClass}`} />
            <div>
              <div className="font-semibold">{BRAND_LABELS[value]}</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {description}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          İptal
        </Button>
      </div>
    </div>
  );
}
