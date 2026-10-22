import { useEffect, useState } from "react";

type EmailStatus = {
  status?: "queued" | "sending" | "retryScheduled" | "sent" | "failed" | "skipped";
  attempts?: number;
  at?: string;
  error?: string;
  retryAt?: string;
};

const labels = { queued: "Kuyrukta", sending: "Gönderiliyor", retryScheduled: "Başarısız; tek tekrar planlandı", sent: "E-posta servisi kabul etti", failed: "Gönderilemedi", skipped: "Gönderim durduruldu" };
const time = (value: string) => new Date(value).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

export function AlarmEmailStatus({ delivery }: { delivery: EmailStatus | null | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  const sendingAt = delivery?.status === "sending" ? delivery.at : undefined;
  useEffect(() => {
    if (!sendingAt) return;
    const deadline = Date.parse(sendingAt) + 10 * 60_000;
    if (!Number.isFinite(deadline)) return;
    // One local deadline per attempt; no polling or extra backend subscription.
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.max(0, deadline - Date.now()) + 1);
    return () => window.clearTimeout(timeout);
  }, [sendingAt]);
  if (!delivery?.status) return <p className="text-sm text-muted-foreground">Henüz gönderim kaydı yok.</p>;
  const interrupted = delivery.status === "sending" && delivery.at !== undefined
    && now - Date.parse(delivery.at) > 10 * 60_000;
  return <div role="status" className="space-y-1 text-sm">
    <p className={interrupted || delivery.status === "failed" || delivery.status === "retryScheduled" ? "text-danger" : undefined}>{interrupted ? "Gönderim yarıda kaldı" : labels[delivery.status]}{delivery.at ? ` · ${time(delivery.at)}` : ""}</p>
    {delivery.attempts !== undefined && <p>Deneme: {delivery.attempts}/2</p>}
    {delivery.error && <p>{delivery.error}</p>}
    {delivery.retryAt && <p>Son yeniden deneme: {time(delivery.retryAt)}</p>}
  </div>;
}
