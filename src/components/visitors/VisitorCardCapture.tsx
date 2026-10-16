import { createCardCaptureSession } from "./cardCaptureSession";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
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
// query ile anında yakalanıp forma düşürülür (getLastUnknownByDevice → bilinmeyen kart).
export default function VisitorCardCapture({ onCapture, currentCard }: VisitorCardCaptureProps) {
  const { devices } = useDevices();
  const { projectId } = useActiveProjectScope();

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

  const session = useRef(createCardCaptureSession());
  const [replacement, setReplacement] = useState<string | null>(null);

  useEffect(() => {
    session.current.rearm();
    setSinceTime(null);
    setCaptured(null);
    setReplacement(null);
  }, [projectId]);

  const validReaderId = devices.some(device => device._id === readerId) ? readerId : null;
  const reading = useQuery(
    api.cardReadings.getLastUnknownByDevice,
    projectId && validReaderId && sinceTime && !captured ? { projectId, deviceId: validReaderId, sinceTime } : "skip",
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

  const setReaderId = (id: Id<"devices"> | null) => {
    setReaderIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage devre dışı olabilir */
    }
    setSinceTime(null);
    setCaptured(null);
  };

  const rearm = () => {
    session.current.rearm();
    setSinceTime(new Date().toISOString());
    setCaptured(null);
  };

  const listening = !!validReaderId && !!sinceTime && !captured;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <Label className="text-sm font-medium">Karttan Oku</Label>
      </div>

      <Select
        value={validReaderId ?? ""}
        onValueChange={(value) => setReaderId((value || null) as Id<"devices"> | null)}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Kayıt okuyucusu seçin" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((d) => (
            <SelectItem key={d._id} value={d._id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {validReaderId && (
        <div className="flex items-center justify-between gap-2 text-sm">
          {captured ? (
            <StatusBadge tone="success">
              <CheckCircle2 className="h-4 w-4" />
              Kart okundu: <span className="font-mono">{captured}</span>
            </StatusBadge>
          ) : listening ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Kartı okutucuya okutun…
            </span>
          ) : <span className="text-muted-foreground">Dinleme kapalı</span>}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={rearm}
            className="h-7 gap-1 text-xs"
            disabled={listening}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {captured ? "Yeniden oku" : "Okumayı başlat"}
          </Button>
        </div>
      )}
      <ConfirmDestructive
        open={replacement !== null}
        onOpenChange={(open) => { if (!open) setReplacement(null); }}
        title="Kart değiştirilsin mi?" objectName={`${currentCard ?? ""} → ${replacement ?? ""}`}
        effects={["Formdaki kart numarası yeni okunan kartla değiştirilecek."]} confirmLabel="Kartı değiştir"
        onConfirm={async () => { if (replacement) onCapture(replacement); setReplacement(null); }}
      />
    </div>
  );
}
