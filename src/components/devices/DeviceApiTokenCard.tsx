import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { formatTrDateTime } from "@/lib/date";
import { useState } from "react";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notify";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface DeviceApiTokenCardProps {
  onPendingChange?: (pending: boolean) => void;
  deviceId: Id<"devices">;
  deviceName?: string;
  currentToken?: string;
  currentTokenCreatedAt?: string;
}

function maskToken(token?: string): string {
  if (!token) return "—";
  return "••••••••";
}

export function DeviceApiTokenCard({
  onPendingChange,
  deviceId,
  deviceName,
  currentToken,
  currentTokenCreatedAt,
}: DeviceApiTokenCardProps) {
  const regenerate = useMutation(api.devices.regenerateApiToken);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRegenerate = async () => {
    setBusy(true);
    onPendingChange?.(true);
    try {
      const result = await regenerate({ deviceId });
      setRevealedToken(result.token);
      notify.success("Yeni anahtar oluşturuldu", "Anahtarı kopyalayıp cihaz köprüsü yapılandırmasına uygulayın.");
    } finally {
      setBusy(false);
      onPendingChange?.(false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      notify.success("Anahtar kopyalandı");
    } catch {
      notify.error("Anahtar kopyalanamadı");
    }
  };

  return (
    <section className="min-w-0 space-y-2 py-3 [&_button]:min-h-11 md:[&_button]:min-h-0">
      <ConfirmDestructive open={confirmOpen} onOpenChange={setConfirmOpen} title="Cihaz bağlantı anahtarını yenile" objectName={deviceName ?? deviceId} effects={["Eski anahtar hemen geçersiz olur.", "Yeni anahtarı kopyalayıp cihaz köprüsü yapılandırmasına uygulayana kadar bağlantı durabilir."]} confirmLabel="Anahtarı yenile" onConfirm={handleRegenerate} />
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Cihaz bağlantı anahtarı</h4>
      </div>
      <p className="text-xs text-muted-foreground">Bağlantı anahtarı, cihazdan gelen kart okumalarını doğrular. Anahtar başkasının eline geçerse yenileyin; eski anahtar geçersiz olur.</p>

        {revealedToken ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-warning">
              Yeni anahtarı kopyalayıp cihaz yapılandırmasına uygulayın:
            </div>
            <div className="flex min-w-0 gap-2">
              <Input value={revealedToken} readOnly className="min-w-0 font-mono text-xs" />
              <Button variant="outline" size="sm" aria-label="Yeni anahtarı kopyala" onClick={() => handleCopy(revealedToken)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Mevcut:</span>
            <code className="font-mono text-xs">{maskToken(currentToken)}</code>
            {currentTokenCreatedAt && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({formatTrDateTime(new Date(currentTokenCreatedAt))})
              </span>
            )}
          </div>
        )}

        <Button onClick={() => setConfirmOpen(true)} disabled={busy} size="sm" variant="outline">
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          {currentToken ? "Anahtarı yenile" : "Anahtar oluştur"}
        </Button>
    </section>
  );
}
