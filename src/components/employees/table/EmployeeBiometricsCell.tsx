import type { LucideIcon } from "lucide-react";
import { Check, Fingerprint, ScanFace } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmployeeBiometrics {
  face: boolean;
  fingerprints: number;
}

function BiometricMark({ icon: Icon, active, label }: { icon: LucideIcon; active: boolean; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex h-6 w-6 items-center justify-center rounded-md border",
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
  );
}

/** Hik-Connect kişi listesindeki gibi: kayıtlı biyometri yeşil + tikli, yoksa soluk. */
export function EmployeeBiometricsCell({ biometrics }: { biometrics?: EmployeeBiometrics }) {
  const face = biometrics?.face ?? false;
  const fingerprints = biometrics?.fingerprints ?? 0;
  return (
    <div className="flex items-center gap-1.5">
      <BiometricMark icon={ScanFace} active={face} label={face ? "Yüz kayıtlı" : "Yüz kaydı yok"} />
      <BiometricMark
        icon={Fingerprint}
        active={fingerprints > 0}
        label={fingerprints > 0 ? `${fingerprints} parmak izi kayıtlı` : "Parmak izi kaydı yok"}
      />
    </div>
  );
}
