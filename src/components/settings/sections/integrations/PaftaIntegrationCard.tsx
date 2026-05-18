import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

type DataScope = {
  employees: boolean;
  pdks: boolean;
  shifts: boolean;
};

const DEFAULT_ENDPOINT = "https://api.pafta.app/v1";

const generateMockApiKey = (): string => {
  const segments = Array.from({ length: 4 }, () =>
    Math.random().toString(36).slice(2, 10),
  );
  return `pfta_${segments.join("")}`;
};

const STATUS_META: Record<
  ConnectionStatus,
  { label: string; variant: "secondary" | "default" | "destructive"; dotClass: string }
> = {
  disconnected: { label: "Bağlı değil", variant: "secondary", dotClass: "bg-muted-foreground" },
  connecting: { label: "Bağlanıyor…", variant: "secondary", dotClass: "bg-amber-500" },
  connected: { label: "Bağlı", variant: "default", dotClass: "bg-emerald-500" },
  error: { label: "Hata", variant: "destructive", dotClass: "bg-destructive" },
};

export function PaftaIntegrationCard() {
  const { toast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [apiKey, setApiKey] = useState<string>(() => generateMockApiKey());
  const [showKey, setShowKey] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [scope, setScope] = useState<DataScope>({
    employees: true,
    pdks: true,
    shifts: false,
  });
  const [isTesting, setIsTesting] = useState(false);

  const testTimerRef = useRef<number | null>(null);
  const connectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (testTimerRef.current !== null) window.clearTimeout(testTimerRef.current);
      if (connectTimerRef.current !== null) window.clearTimeout(connectTimerRef.current);
    };
  }, []);

  const isConnected = status === "connected";
  const statusMeta = STATUS_META[status];

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Kopyalandı", description: `${label} panoya kopyalandı.` });
    } catch {
      toast({
        variant: "destructive",
        title: "Kopyalanamadı",
        description: "Tarayıcı izin vermedi.",
      });
    }
  };

  const handleRegenerateKey = () => {
    setApiKey(generateMockApiKey());
    toast({
      title: "Yeni API key üretildi",
      description: "Anahtarı kopyalayıp Pafta tarafına yapıştırın.",
    });
  };

  const handleTestConnection = () => {
    setIsTesting(true);
    testTimerRef.current = window.setTimeout(() => {
      testTimerRef.current = null;
      setIsTesting(false);
      const ok = Math.random() > 0.3;
      toast({
        variant: ok ? "default" : "destructive",
        title: ok ? "Bağlantı başarılı" : "Bağlantı başarısız",
        description: ok
          ? "Pafta API'sine erişim doğrulandı."
          : "Endpoint'e ulaşılamadı. Bilgileri kontrol edin.",
      });
    }, 1500);
  };

  const handleToggleConnection = () => {
    if (isConnected) {
      setStatus("disconnected");
      setLastSync(null);
      toast({ title: "Bağlantı kesildi", description: "Pafta entegrasyonu devre dışı." });
      return;
    }

    setStatus("connecting");
    connectTimerRef.current = window.setTimeout(() => {
      connectTimerRef.current = null;
      setStatus("connected");
      setLastSync(new Date());
      toast({
        title: "Bağlandı",
        description: "Pafta entegrasyonu aktif. Senkron yakında başlayacak.",
      });
    }, 1500);
  };

  const toggleScope = (key: keyof DataScope) => {
    setScope((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/10 to-indigo-500/10 text-base font-semibold text-primary">
              P
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base">Pafta</CardTitle>
              <CardDescription>
                Ön muhasebe & bordro entegrasyonu. Çalışan, PDKS ve vardiya verilerini
                senkronize edin.
              </CardDescription>
            </div>
          </div>
          <Badge variant={statusMeta.variant} className="shrink-0 gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dotClass)} />
            {statusMeta.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="pafta-endpoint">API Endpoint</Label>
          <div className="flex gap-2">
            <Input
              id="pafta-endpoint"
              value={DEFAULT_ENDPOINT}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleCopy(DEFAULT_ENDPOINT, "Endpoint")}
              aria-label="Endpoint'i kopyala"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pafta-api-key">API Key</Label>
          <div className="flex gap-2">
            <Input
              id="pafta-api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "API key'i gizle" : "API key'i göster"}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleCopy(apiKey, "API key")}
              aria-label="API key'i kopyala"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleRegenerateKey}
              aria-label="API key'i yenile"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Bu anahtarı Pafta tarafına yapıştırarak iki sistem arası güvenli bağlantıyı
            kurun.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Son senkronizasyon</span>
          <span className="font-medium">
            {lastSync ? lastSync.toLocaleString("tr-TR") : "—"}
          </span>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Senkronize edilecek veriler</Label>
            <p className="text-xs text-muted-foreground">
              Hangi veri tiplerinin Pafta ile paylaşılacağını seçin.
            </p>
          </div>
          <div className="space-y-2">
            <ScopeRow
              id="scope-employees"
              checked={scope.employees}
              onChange={() => toggleScope("employees")}
              title="Çalışan kayıtları"
              description="Ad, soyad, departman, pozisyon, kart numarası"
            />
            <ScopeRow
              id="scope-pdks"
              checked={scope.pdks}
              onChange={() => toggleScope("pdks")}
              title="PDKS / Kart okuma verileri"
              description="Giriş-çıkış zamanları, mesai saatleri, fazla mesai"
            />
            <ScopeRow
              id="scope-shifts"
              checked={scope.shifts}
              onChange={() => toggleScope("shifts")}
              title="Vardiya bilgileri"
              description="Vardiya tanımları ve çalışan atamaları"
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting || status === "connecting"}
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Test ediliyor…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Bağlantıyı Test Et
              </>
            )}
          </Button>
          <Button
            type="button"
            variant={isConnected ? "destructive" : "default"}
            onClick={handleToggleConnection}
            disabled={status === "connecting"}
          >
            {status === "connecting" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Bağlanıyor…
              </>
            ) : isConnected ? (
              <>
                <AlertCircle className="mr-2 h-4 w-4" />
                Bağlantıyı Kes
              </>
            ) : (
              "Bağlan"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ScopeRowProps {
  id: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}

function ScopeRow({ id, checked, onChange, title, description }: ScopeRowProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        checked ? "border-primary/40 bg-primary/5" : "hover:bg-muted/40",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="mt-0.5"
      />
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}
