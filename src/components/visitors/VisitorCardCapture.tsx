import { usePermissions } from "@/hooks/usePermissions";
import { canCaptureVisitorCard, visitorReaderLabel } from "./lib/readerCapability";
import { createCardCaptureSession } from "./cardCaptureSession";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useDevices } from "@/hooks/useDevices";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CreditCard, CheckCircle2, RefreshCw } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

const STORAGE_KEY = "ngs.visitorRegisterReader";

interface VisitorCardCaptureProps {
  onCapture: (cardNo: string) => void;
  currentCard?: string;
}

// Kayıt okuyucusu seçilir; ziyaretçi kartı bastırılınca okunan numara Convex reaktif
// query ile yakalanır; pasif ziyaretçiden geri alınabilecek kartlar da kabul edilir.
export default function VisitorCardCapture({ onCapture, currentCard }: VisitorCardCaptureProps) {
  const { can } = usePermissions();
  const canCapture = can("employees.manage") || can("visitors.manage") || can("devices.manage") || can("reports.view");
  const { devices: projectDevices } = useDevices();
  const devices = projectDevices.filter(canCaptureVisitorCard);
  const { projectId } = useActiveProjectScope();
  const startCardCapture = useMutation(api.cardReadings.startCardCapture);

  const [readerId, setReaderIdState] = useState<Id<"devices"> | null>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v ? (v as Id<"devices">) : null;
    } catch {
      return null;
    }
  });
  // Kayıt ekranı açıldığı/yeniden okutulduğu an — eski okumaları ele.
  const [sinceTime, setSinceTime] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [starting, setStarting] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const previousCapture = useRef<string | null>(null);
  const session = useRef(createCardCaptureSession());
  const [replacement, setReplacement] = useState<string | null>(null);

  const validReaderId = devices.some(device => device._id === readerId) ? readerId : null;

  useEffect(() => {
    const currentSession = session.current;
    currentSession.cancel();
    setSinceTime(null);
    setCaptured(null);
    setReplacement(null);
    setTimedOut(false);
    setStarting(false);
    setCaptureError(null);
    return () => currentSession.cancel();
  }, [projectId, validReaderId]);

  const reading = useQuery(
    api.cardReadings.getLastUnknownByDevice,
    canCapture && projectId && validReaderId && sinceTime && !captured ? { projectId, deviceId: validReaderId, sinceTime, includeInactiveVisitorCards: true } : "skip",
  );

  useEffect(() => {
    if (!sinceTime || captured) return;
    const card = session.current.capture(reading?.cardNo);
    if (!card) return;
    setCaptured(card);
    setSinceTime(null);
    if (currentCard && currentCard !== card) setReplacement(card);
    else onCapture(card);
  }, [reading, captured, onCapture, sinceTime, currentCard]);

  useEffect(() => {
    if (!sinceTime || captured) return;
    const timer = window.setTimeout(() => { setSinceTime(null); setTimedOut(true); }, 30000);
    return () => window.clearTimeout(timer);
  }, [sinceTime, captured]);

  const setReaderId = (id: Id<"devices"> | null) => {
    session.current.cancel();
    setReaderIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage devre dışı olabilir */
    }
    setSinceTime(null);
    setCaptured(null);
    setTimedOut(false);
    setStarting(false);
    setCaptureError(null);
    setReplacement(null);
  };

  const rearm = async () => {
    if (!canCapture || !projectId || !validReaderId) return;
    setTimedOut(false);
    setCaptureError(null);
    setStarting(true);
    previousCapture.current = captured === currentCard ? captured : null;
    const token = session.current.rearm();
    setCaptured(null);
    try {
      const startedAt = await startCardCapture({ projectId, deviceId: validReaderId });
      if (session.current.isCurrent(token)) setSinceTime(startedAt);
    } catch {
      if (session.current.isCurrent(token)) setCaptureError("Okuma başlatılamadı. Yeniden deneyin.");
    } finally {
      if (session.current.isCurrent(token)) setStarting(false);
    }
  };

  const listening = !!validReaderId && !!sinceTime && !captured;

  return (
    <div className="min-w-0 rounded-md border p-3 space-y-2" role="group" aria-label="Kart okuyucudan alma">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <Label htmlFor="visitor-reader" className="text-sm font-medium">Kayıt okuyucusu</Label>
      </div>

      <Select
        value={validReaderId ?? ""}
        onValueChange={(value) => setReaderId((value || null) as Id<"devices"> | null)}
      >
        <SelectTrigger id="visitor-reader" className="h-9 text-sm">
          <SelectValue placeholder="Kayıt okuyucusu seçin" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((d) => (
            <SelectItem key={d._id} value={d._id}>
              {visitorReaderLabel(d)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {validReaderId && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          {captured && captured === currentCard && !replacement ? (
            <StatusBadge tone="success" role="status">
              <CheckCircle2 className="h-4 w-4" />
              Kart okundu: <span className="font-mono">{`•••• ${captured.slice(-4)}`}</span>
            </StatusBadge>
          ) : listening ? (
            <span role="status" className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Kartı seçili okuyucuya okutun. İlk okuma forma alınır.
            </span>
          ) : <span role="status" className="text-muted-foreground">{captureError ?? (starting ? "Okuma başlatılıyor…" : timedOut ? "30 saniyede kart okunmadı. Okuyucuyu kontrol edin veya numarayı elle girin." : "Dinleme kapalı")}</span>}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={starting || !canCapture}
            onClick={() => listening ? setSinceTime(null) : void rearm()}
            className="h-7 gap-1 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {listening ? "Durdur" : timedOut ? "Yeniden dene" : captured ? "Yeniden oku" : "Okumayı başlat"}
          </Button>
        </div>
      )}
      {!devices.length && <p className="text-xs text-muted-foreground">Bu projede kayıt okuyucusu yok. Kart numarasını elle girebilirsiniz.</p>}
      <ConfirmDestructive
        open={replacement !== null}
        onOpenChange={(open) => { if (!open) { setReplacement(null); setCaptured(previousCapture.current); } }}
        title="Kart değiştirilsin mi?" objectName={`•••• ${currentCard?.slice(-4) ?? ""} → •••• ${replacement?.slice(-4) ?? ""}`}
        effects={["Formdaki kart numarası yeni okunan kartla değiştirilecek."]} confirmLabel="Kartı değiştir"
        onConfirm={async () => { if (replacement) { previousCapture.current = replacement; onCapture(replacement); setCaptured(replacement); } setReplacement(null); }}
      />
    </div>
  );
}
