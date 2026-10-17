import { Button } from "@/components/ui/button";
import { Cpu, Wifi, LayoutGrid } from "lucide-react";
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
    description: "Gateway veya yerel köprü",
    Icon: Cpu,
    iconClass: "text-muted-foreground",
  },
  {
    value: "ide_smart",
    description: "MQTT ile bağlanan çok kapılı panel",
    Icon: LayoutGrid,
    iconClass: "text-muted-foreground",
  },
  {
    value: "other",
    description: "ESP32, QR okuyucu ve diğer cihazlar",
    Icon: Wifi,
    iconClass: "text-muted-foreground",
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

      <div className="grid grid-cols-1 gap-2">
        {OPTIONS.map(({ value, description, Icon, iconClass }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className="group flex items-center gap-3 rounded-md border border-line bg-surface p-4 text-left transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className={`w-5 h-5 ${iconClass}`} />
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
