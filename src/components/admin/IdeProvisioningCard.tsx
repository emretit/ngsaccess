import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Info, CheckCircle2, XCircle, RefreshCw, Radio } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * IDE Smart paneli LOCAL köprü servisi (scripts/ide-provision-agent.mjs) üzerinden
 * Hetzner broker'a alır. Köprü kullanıcının PC'sinde `npm run ide-agent` ile çalışır;
 * bu UI yalnızca http://127.0.0.1:8765'e istek atar (panel LAN IP'sine cloud/HTTPS'ten
 * doğrudan ulaşılamadığı için — bkz. plan).
 */

const AGENT_BASE = "http://127.0.0.1:8765";

type AgentHealth = { ok: boolean; broker: string | null; brokerPort: number; configError: string | null };
type ProvisionResult = {
  ok: boolean;
  uuid: string;
  level: string;
  readback: Record<string, unknown>;
  rebooted: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asProvisionResult(v: unknown): ProvisionResult | null {
  if (!isRecord(v)) return null;
  if (typeof v.uuid !== "string") return null;
  return {
    ok: v.ok === true,
    uuid: v.uuid,
    level: typeof v.level === "string" ? v.level : "?",
    readback: isRecord(v.readback) ? v.readback : {},
    rebooted: v.rebooted === true,
  };
}

const READBACK_KEYS = [
  "MQTT.BROKER",
  "MQTT.PORT",
  "MQTT.SSL_ENABLED",
  "MQTT.STATUS",
  "MQTT.TOPIC_SUBSCRIBE",
  "MQTT.TOPIC_PUBLISH",
  "LOGGER.PROTOCOL",
  "LOGGER.HB_ENABLED",
] as const;

export function IdeProvisioningCard() {
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [healthChecking, setHealthChecking] = useState(true);
  const [ip, setIp] = useState("192.168.1.4");
  const [l3Pass, setL3Pass] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [statusChecking, setStatusChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setHealthChecking(true);
    try {
      const res = await fetch(`${AGENT_BASE}/health`, { method: "GET" });
      const json: unknown = await res.json();
      if (isRecord(json) && json.ok === true) {
        setHealth({
          ok: true,
          broker: typeof json.broker === "string" ? json.broker : null,
          brokerPort: typeof json.brokerPort === "number" ? json.brokerPort : 0,
          configError: typeof json.configError === "string" ? json.configError : null,
        });
      } else {
        setHealth(null);
      }
    } catch {
      setHealth(null);
    } finally {
      setHealthChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const handleProvision = async () => {
    if (!ip.trim()) {
      toast({ title: "Hata", description: "Panel IP gerekli", variant: "destructive" });
      return;
    }
    setProvisioning(true);
    setResult(null);
    try {
      const res = await fetch(`${AGENT_BASE}/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: ip.trim(), ...(l3Pass ? { l3Pass } : {}) }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg = isRecord(json) && typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const parsed = asProvisionResult(json);
      if (!parsed) throw new Error("Köprü beklenmeyen yanıt döndü");
      setResult(parsed);
      toast({
        title: parsed.ok ? "Başarılı" : "Kısmi",
        description: parsed.ok
          ? `Panel ${parsed.uuid} broker'a alındı, reboot edildi.`
          : "Yazma kısmen başarısız — read-back'i kontrol edin.",
        variant: parsed.ok ? "default" : "destructive",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provision başarısız";
      toast({ title: "Hata", description: message, variant: "destructive" });
    } finally {
      setProvisioning(false);
    }
  };

  const handleCheckStatus = async () => {
    setStatusChecking(true);
    try {
      const res = await fetch(`${AGENT_BASE}/panel-status?ip=${encodeURIComponent(ip.trim())}`);
      const json: unknown = await res.json();
      if (!res.ok || !isRecord(json) || json.ok !== true) {
        const msg = isRecord(json) && typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const readback = isRecord(json.readback) ? json.readback : {};
      setResult((prev) => (prev ? { ...prev, readback } : prev));
      const status = readback["MQTT.STATUS"];
      toast({ title: "Panel durumu", description: `MQTT.STATUS = ${String(status ?? "?")}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Durum okunamadı";
      toast({ title: "Hata", description: message, variant: "destructive" });
    } finally {
      setStatusChecking(false);
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="h-4 w-4" />
          Paneli Broker'a Al (Provisioning)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Köprü durumu */}
        <div
          className={
            health?.ok
              ? "flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs"
              : "flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs"
          }
        >
          <div className="flex items-center gap-2">
            {healthChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : health?.ok ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className={health?.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
              {healthChecking
                ? "Köprü kontrol ediliyor…"
                : health?.ok
                  ? `Köprü çalışıyor (broker: ${health.broker ?? "?"})`
                  : "Köprü çalışmıyor"}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void checkHealth()} disabled={healthChecking}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {!health?.ok && !healthChecking && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            PC'de köprü servisini başlatın:
            <code className="mt-1 block rounded bg-black/10 px-2 py-1 font-mono dark:bg-white/10">npm run ide-agent</code>
            Köprü panelle aynı yerel ağda çalışmalı.
          </div>
        )}

        {health?.configError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-400">
            {health.configError}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-400">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Panel fabrika broker'ından bizim Hetzner broker'ımıza alınır (L3 login → MQTT/LOGGER
            yazma → reboot). İşlem sonrası panel ~30-60sn içinde broker'a bağlanır.
          </span>
        </div>

        <div className="space-y-2">
          <Label>Panel IP</Label>
          <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.4" />
        </div>
        <div className="space-y-2">
          <Label>L3 şifre (opsiyonel)</Label>
          <Input
            type="password"
            value={l3Pass}
            onChange={(e) => setL3Pass(e.target.value)}
            placeholder="Boş bırakılırsa köprü .env.local'daki şifreyi kullanır"
          />
        </div>

        <div className="flex justify-end gap-2">
          {result && (
            <Button variant="outline" onClick={() => void handleCheckStatus()} disabled={statusChecking}>
              {statusChecking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Durumu kontrol et
            </Button>
          )}
          <Button onClick={() => void handleProvision()} disabled={provisioning || !health?.ok}>
            {provisioning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Broker'a Al
          </Button>
        </div>

        {result && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              UUID {result.uuid} · level {result.level} · {result.rebooted ? "reboot edildi" : "reboot edilmedi"}
            </div>
            <table className="w-full">
              <tbody>
                {READBACK_KEYS.map((k) => (
                  <tr key={k} className="border-t border-border/50">
                    <td className="py-1 pr-2 font-mono text-muted-foreground">{k}</td>
                    <td className="py-1 font-mono">{String(result.readback[k] ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
