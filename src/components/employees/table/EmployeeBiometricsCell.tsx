import type { LucideIcon } from "lucide-react";
import { Check, Fingerprint, ScanFace } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface EmployeeBiometrics {
  face: boolean;
  fingerNos: number[];
}

function BiometricMark({ icon: Icon, active, title, detail }: { icon: LucideIcon; active: boolean; title: string; detail?: string }) {
  const label = detail ? `${title}: ${detail}` : title;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Klavye ile de odaklanır; tooltip yalnız görsel, metin aria-label'da. */}
        <span
          role="img"
          tabIndex={0}
          aria-label={label}
          className={cn(
            "relative inline-flex h-6 w-6 items-center justify-center rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-transparent text-muted-foreground/40",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {active && (
            <Check
              className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-600 p-px text-white"
              strokeWidth={3}
              aria-hidden="true"
            />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60 text-xs">
        <p className="font-medium">{title}</p>
        {detail && <p className="text-muted-foreground">{detail}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

/** Hik-Connect kişi listesindeki gibi: kayıtlı biyometri yeşil + tikli, yoksa soluk; üstüne gelince ayrıntı. */
export function EmployeeBiometricsCell({ biometrics }: { biometrics?: EmployeeBiometrics }) {
  const face = biometrics?.face ?? false;
  const fingerNos = biometrics?.fingerNos ?? [];
  return (
    // Tablo satırlarında hızlı açılsın diye kendi sağlayıcısı (uygulama varsayılanı 700 ms).
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1.5">
        <BiometricMark icon={ScanFace} active={face} title={face ? "Yüz kayıtlı" : "Yüz kaydı yok"} />
        <BiometricMark
          icon={Fingerprint}
          active={fingerNos.length > 0}
          title={fingerNos.length > 0 ? `${fingerNos.length} parmak izi kayıtlı` : "Parmak izi kaydı yok"}
        />
      </div>
    </TooltipProvider>
  );
}
