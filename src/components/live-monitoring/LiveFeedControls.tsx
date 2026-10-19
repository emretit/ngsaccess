import { useEffect, useRef, useState } from "react";
import { useConvexConnectionState } from "convex/react";
import { Button } from "@/components/ui/button";
export function LiveFeedControls({ paused, count, reloadRequired, onPause, onApply, onReload, lastEvent }: { paused: boolean; count: number; reloadRequired: boolean; onPause: () => void; onApply: () => void; onReload: () => void; lastEvent?: string }) {
  const connection = useConvexConnectionState();
  const [announcedCount, setAnnouncedCount] = useState(0);
  const latestCount = useRef(count);
  useEffect(() => { latestCount.current = count; }, [count]);
  useEffect(() => { const timer = window.setInterval(() => setAnnouncedCount(latestCount.current), 5000); return () => window.clearInterval(timer); }, []);
  return <div className="flex min-w-0 flex-wrap items-center gap-3 border-y border-line py-3">
    <Button variant="outline" onClick={paused ? onApply : onPause} disabled={reloadRequired}>{paused ? "Devam et" : "Görüntüyü durdur"}</Button>
    {reloadRequired ? <Button variant="outline" onClick={onReload}>Yeni kayıtlar var · Yeniden yükle</Button> : count > 0 && <Button variant="outline" onClick={onApply}>{count} yeni kaydı göster</Button>}
    <p className="text-xs text-muted-foreground" role="status">{connection.isWebSocketConnected ? "Abonelik bağlı" : "Bağlantı kesildi · Gösterilen kayıtlar güncel olmayabilir"} · {paused ? "Görüntü durduruldu; kayıt alımı sürüyor" : "Görüntü güncelleniyor"}</p>
    <span className="sr-only" role="status">{announcedCount > 0 ? `${announcedCount} yeni kayıt bekliyor` : ""}</span>
    {lastEvent && <span className="text-xs text-muted-foreground">Son okuma {lastEvent}</span>}
  </div>;
}
