import { useState } from "react";
import { useMutation } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface DeviceApiTokenCardProps {
  deviceId: Id<"devices">;
  currentToken?: string;
  currentTokenCreatedAt?: string;
}

function maskToken(token?: string): string {
  if (!token) return "—";
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}••••••${token.slice(-4)}`;
}

export function DeviceApiTokenCard({
  deviceId,
  currentToken,
  currentTokenCreatedAt,
}: DeviceApiTokenCardProps) {
  const { toast } = useToast();
  const regenerate = useMutation(api.devices.regenerateApiToken);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleRegenerate = async () => {
    setBusy(true);
    try {
      const result = await regenerate({ deviceId });
      setRevealedToken(result.token);
      toast({
        title: "Yeni token oluşturuldu",
        description: "Token'ı kopyalayıp cihaz bridge config'ine yapıştırın. Bu pencereyi kapattıktan sonra bir daha gösterilmeyecek.",
      });
    } catch (error) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Token oluşturulamadı",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Kopyalandı" });
    } catch {
      toast({ title: "Kopyalanamadı", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          Cihaz API Token
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Bridge cihaz POST'unda <code className="rounded bg-muted px-1 py-0.5">Authorization: Bearer &lt;token&gt;</code> header'ı yollar. Token sızarsa "Yenile" ile geri çevir; eski token geçersiz olur.
        </p>

        {revealedToken ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Bu token bir daha gösterilmeyecek — şimdi kopyalayın:
            </div>
            <div className="flex gap-2">
              <Input value={revealedToken} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={() => handleCopy(revealedToken)}>
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

        <Button onClick={handleRegenerate} disabled={busy} size="sm" variant="outline">
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          {currentToken ? "Token'ı Yenile" : "Token Oluştur"}
        </Button>
      </CardContent>
    </Card>
  );
}
