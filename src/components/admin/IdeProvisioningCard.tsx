import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Info, CheckCircle2, XCircle, RefreshCw, Radio, Search, ChevronDown } from "lucide-react";
import { errorMessage, notify } from "@/lib/notify";

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

  const [subnet, setSubnet] = useState("192.168.1");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [foundPanels, setFoundPanels] = useState<string[] | null>(null);

  const [ip, setIp] = useState("");
  const [showManualIp, setShowManualIp] = useState(false);
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

  const handleScan = async () => {
    const s = subnet.trim();
    if (!s) {
      notify.error("Hata", "Subnet gerekli (örn. 192.168.1)");
      return;
    }
    setScanning(true);
    setScanProgress(0);
    setFoundPanels(null);
    setResult(null);
    setIp("");
    setShowManualIp(false);

    // Simüle edilmiş ilerleme — tarama ~15sn sürer, 100ms'de ~0.6% artış
    const timer = setInterval(() => {
      setScanProgress((p) => (p < 90 ? p + 0.6 : p));
    }, 100);

    try {
      const res = await fetch(`${AGENT_BASE}/scan?subnet=${encodeURIComponent(s)}`);
      const json: unknown = await res.json();
      if (!res.ok || !isRecord(json)) throw new Error(`HTTP ${res.status}`);
      const panels = Array.isArray(json.panels) ? (json.panels as string[]) : [];
      setScanProgress(100);
      setFoundPanels(panels);
      if (panels.length === 0) {
        notify.error("Panel bulunamadı", `${s}.x ağında IDE Smart panel yok`);
      } else {
        setIp(panels[0]);
        notify.success(`${panels.length} panel bulundu`, panels.join(", "));
      }
    } catch (error) {
      const message = errorMessage(error);
      notify.error("Hata", message);
    } finally {
      clearInterval(timer);
      setScanning(false);
    }
  };

  const handleProvision = async () => {
    if (!ip.trim()) {
      notify.error("Hata", "Panel IP gerekli");
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
      if (parsed.ok) {
        notify.success("Başarılı", `Panel ${parsed.uuid} broker'a alındı, reboot edildi.`);
      } else {
        notify.error("Kısmi", "Yazma kısmen başarısız — read-back'i kontrol edin.");
      }
    } catch (error) {
      const message = errorMessage(error);
      notify.error("Hata", message);
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
      notify.info("Panel durumu", `MQTT.STATUS = ${String(status ?? "?")}`);
    } catch (error) {
      const message = errorMessage(error);
      notify.error("Hata", message);
    } finally {
      setStatusChecking(false);
    }
  };

  return (
    <Card className="max-w-xl">
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
              ? "flex items-center justify-between rounded-lg border border-success/30 bg-success-bg p-3 text-xs"
              : "flex items-center justify-between rounded-lg border border-destructive/30 bg-danger-bg p-3 text-xs"
          }
        >
          <div className="flex items-center gap-2">
            {healthChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : health?.ok ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className={health?.ok ? "text-success" : "text-destructive"}>
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
          <div className="rounded-lg border border-warning/30 bg-warning-bg p-3 text-xs text-warning">
            PC'de köprü servisini başlatın:
            <code className="mt-1 block rounded bg-muted px-2 py-1 font-mono">npm run ide-agent</code>
            Köprü panelle aynı yerel ağda çalışmalı.
          </div>
        )}

        {health?.configError && (
          <div className="rounded-lg border border-destructive/30 bg-danger-bg p-3 text-xs text-destructive">
            {health.configError}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-bg p-3 text-xs text-info">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Panel fabrika broker'ından bizim Hetzner broker'ımıza alınır (L3 login → MQTT/LOGGER
            yazma → reboot). İşlem sonrası panel ~30-60sn içinde broker'a bağlanır.
          </span>
        </div>

        {/* Ağ tarama */}
        <div className="space-y-2">
          <Label>Subnet (ağ tarama)</Label>
          <div className="flex gap-2">
            <Input
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              placeholder="192.168.1"
              className="font-mono"
            />
            <Button
              variant="outline"
              onClick={() => void handleScan()}
              disabled={scanning || !health?.ok}
              className="shrink-0"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">{scanning ? "Taranıyor…" : "Tara"}</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {subnet}.1 – {subnet}.254 aralığı taranır (~15-20sn)
          </p>
          {scanning && (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-100"
                  style={{ width: `${scanProgress.toFixed(0)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{scanProgress.toFixed(0)}%</p>
            </div>
          )}
        </div>

        {/* Bulunan paneller listesi */}
        {foundPanels !== null && foundPanels.length > 0 && (
          <div className="space-y-1">
            <Label>Bulunan Paneller</Label>
            <div className="rounded-md border divide-y">
              {foundPanels.map((panelIp) => (
                <button
                  key={panelIp}
                  type="button"
                  onClick={() => setIp(panelIp)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors ${
                    ip === panelIp ? "bg-primary/10 font-medium text-primary" : ""
                  }`}
                >
                  <span className="font-mono">{panelIp}</span>
                  {ip === panelIp && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manuel IP — tarama sonucu yoksa veya toggle açıksa */}
        {(foundPanels === null || foundPanels.length === 0 || showManualIp) ? (
          <div className="space-y-2">
            <Label>Panel IP {foundPanels !== null && foundPanels.length === 0 && <span className="text-muted-foreground">(taramada bulunamadı)</span>}</Label>
            <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.4" className="font-mono" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowManualIp(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="h-3 w-3" />
            Manuel IP gir
          </button>
        )}

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
          <Button onClick={() => void handleProvision()} disabled={provisioning || !health?.ok || !ip.trim()}>
            {provisioning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Broker'a Al
          </Button>
        </div>

        {result && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
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
