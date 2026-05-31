import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
}

// Kayıt okuyucusu seçilir; ziyaretçi kartı bastırılınca okunan numara Convex reaktif
// query ile anında yakalanıp forma düşürülür (getLastUnknownByDevice → bilinmeyen kart).
export default function VisitorCardCapture({ onCapture }: VisitorCardCaptureProps) {
  const { devices } = useDevices();

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

  useEffect(() => {
    setSinceTime(new Date().toISOString());
  }, []);

  const reading = useQuery(
    api.cardReadings.getLastUnknownByDevice,
    readerId && sinceTime ? { deviceId: readerId, sinceTime } : "skip",
  );

  useEffect(() => {
    if (reading?.cardNo && reading.cardNo !== captured) {
      setCaptured(reading.cardNo);
      onCapture(reading.cardNo);
    }
  }, [reading, captured, onCapture]);

  const setReaderId = (id: Id<"devices"> | null) => {
    setReaderIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage devre dışı olabilir */
    }
    setSinceTime(new Date().toISOString());
    setCaptured(null);
  };

  const rearm = () => {
    setSinceTime(new Date().toISOString());
    setCaptured(null);
  };

  const listening = !!readerId && !captured;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <Label className="text-sm font-medium">Karttan Oku</Label>
      </div>

      <Select
        value={readerId ?? ""}
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

      {readerId && (
        <div className="flex items-center justify-between gap-2 text-sm">
          {captured ? (
            <span className="flex items-center gap-1.5 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Kart okundu: <span className="font-mono">{captured}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Kartı okutucuya okutun…
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={rearm}
            className="h-7 gap-1 text-xs"
            disabled={listening}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Yeniden oku
          </Button>
        </div>
      )}
    </div>
  );
}
