import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useState } from "react";
import { useMutation } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notify";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface DeviceApiTokenCardProps {
  deviceId: Id<"devices">;
  deviceName?: string;
  currentToken?: string;
  currentTokenCreatedAt?: string;
}

function maskToken(token?: string): string {
  if (!token) return "—";
  if (token.length <= 12) return "••••••••";
  return `${token.slice(0, 6)}••••••${token.slice(-4)}`;
}

export function DeviceApiTokenCard({
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
    try {
      const result = await regenerate({ deviceId });
      setRevealedToken(result.token);
      notify.success("Yeni anahtar oluşturuldu", "Anahtarı kopyalayıp cihaz köprüsü yapılandırmasına uygulayın.");
    } finally {
      setBusy(false);
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
    <Card className="min-w-0 border-0 border-t rounded-none shadow-none">
      <ConfirmDestructive open={confirmOpen} onOpenChange={setConfirmOpen} title="Cihaz bağlantı anahtarını yenile" objectName={deviceName ?? deviceId} effects={["Eski anahtar hemen geçersiz olur.", "Yeni anahtarı kopyalayıp bridge yapılandırmasına uygulayana kadar bağlantı durabilir."]} confirmLabel="Anahtarı yenile" onConfirm={handleRegenerate} />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          Cihaz bağlantı anahtarı
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Bağlantı anahtarı nasıl kullanılır?</summary><p className="mt-2 break-words">
          Token'sız kart olayı reddedilir. Bridge <code className="rounded bg-muted px-1 py-0.5">Authorization: Bearer &lt;token&gt;</code> header'ı yollar; header ekleyemeyen cihazda (Hikvision httpHosts) adresin sonuna <code className="rounded bg-muted px-1 py-0.5">/card-reader?token=&lt;token&gt;</code> yazın. Token sızarsa "Yenile" ile geri çevir; eski token geçersiz olur.
        </p></details>

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
                ({new Date(currentTokenCreatedAt).toLocaleString("tr-TR")})
              </span>
            )}
          </div>
        )}

        <Button onClick={() => setConfirmOpen(true)} disabled={busy} size="sm" variant="outline">
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          {currentToken ? "Anahtarı yenile" : "Anahtar oluştur"}
        </Button>
      </CardContent>
    </Card>
  );
}
