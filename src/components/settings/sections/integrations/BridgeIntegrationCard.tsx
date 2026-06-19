import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Copy, Eye, EyeOff, Plus, Trash2, Loader2, Router } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/**
 * Hikvision LAN bridge token yönetimi (tek-yer modeli). Üretilen token, bridge EXE'nin
 * /__bridge ekranına bir kez girilir; bridge o token ile bu projedeki tüm localBridge
 * panellerini (IP/şifre/işler) otomatik çeker. Panel bilgileri cihaz formundan girilir.
 */
export function BridgeIntegrationCard() {
  const { toast } = useToast();
  const { activeProjectId } = useActiveProject();
  const bridges = useQuery(
    api.hikBridge.listBridges,
    activeProjectId ? { projectId: activeProjectId } : "skip",
  );
  const createBridge = useMutation(api.hikBridge.createBridge);
  const revokeBridge = useMutation(api.hikBridge.revokeBridge);

  const [creating, setCreating] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const handleCreate = async () => {
    if (!activeProjectId) return;
    setCreating(true);
    try {
      const result = await createBridge({ projectId: activeProjectId });
      setReveal((m) => ({ ...m, [result.bridgeId]: true }));
      toast({
        title: "Bridge token oluşturuldu",
        description: "Token'ı kopyalayıp bridge EXE'nin ayar ekranına girin.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Token oluşturulamadı",
        description: e instanceof Error ? e.message : "Bilinmeyen hata",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (bridgeId: Id<"hikBridges">) => {
    if (!window.confirm("Bu bridge token iptal edilsin mi? O bridge artık bağlanamaz.")) return;
    try {
      await revokeBridge({ bridgeId });
      toast({ title: "İptal edildi", description: "Bridge token kaldırıldı." });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "İptal edilemedi",
        description: e instanceof Error ? e.message : "Bilinmeyen hata",
      });
    }
  };

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      toast({ title: "Kopyalandı", description: "Bridge token panoya kopyalandı." });
    } catch {
      toast({ variant: "destructive", title: "Kopyalanamadı", description: "Tarayıcı izin vermedi." });
    }
  };

  const mask = (token: string) => `${token.slice(0, 8)}••••••••••••`;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/10 to-sky-500/10 text-primary">
              <Router className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base">Hikvision Bridge</CardTitle>
              <CardDescription>
                LAN'daki Windows bridge bu token ile panelleri otomatik çeker. Panel IP/şifresi
                cihaz formunda girilir; burada yalnız bridge'in kimliği üretilir.
              </CardDescription>
            </div>
          </div>
          <Button type="button" size="sm" onClick={handleCreate} disabled={!activeProjectId || creating}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Yeni Token
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!activeProjectId && (
          <p className="text-sm text-muted-foreground">
            Token oluşturmak için önce bir proje seçin.
          </p>
        )}

        {activeProjectId && bridges === undefined && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
          </div>
        )}

        {activeProjectId && bridges?.length === 0 && (
          <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Henüz bridge token yok. Bir Windows bridge kuracaksanız "Yeni Token" ile oluşturun.
          </p>
        )}

        {bridges?.map((b) => {
          const shown = reveal[b._id] ?? false;
          return (
            <div
              key={b._id}
              className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Input
                  readOnly
                  value={shown ? b.token : mask(b.token)}
                  className="font-mono text-xs"
                />
                <span className="text-xs text-muted-foreground">
                  {b.lastSeenAt
                    ? `Son bağlantı: ${new Date(b.lastSeenAt).toLocaleString("tr-TR")}`
                    : "Henüz bağlanmadı"}
                </span>
              </div>
              {!b.lastSeenAt && (
                <Badge variant="secondary" className="shrink-0">
                  bekliyor
                </Badge>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setReveal((m) => ({ ...m, [b._id]: !shown }))}
                aria-label={shown ? "Token'ı gizle" : "Token'ı göster"}
              >
                {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleCopy(b.token)}
                aria-label="Token'ı kopyala"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleRevoke(b._id)}
                aria-label="Token'ı iptal et"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground">
          Token'ı bridge EXE'de <code className="font-mono">http://127.0.0.1:8787/__bridge</code> ekranına
          yapıştırın. Bir bridge, projedeki tüm localBridge panellerini tek token ile yönetir.
        </p>
      </CardContent>
    </Card>
  );
}
