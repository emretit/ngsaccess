import { StatusBadge } from "@/components/shared/StatusBadge";
import { errorMessage } from "@/lib/notify";
import type { PlanResult } from "../doorPlanResult";

export function DoorSaveResults({ planResults, isSubmitting, saved }: { planResults: PlanResult[]; isSubmitting: boolean; saved: boolean }) {
  return (

            <div className="mb-4 space-y-2 rounded-md border p-3" role="status" aria-live="polite">
              {saved && <>
                <StatusBadge tone="success">Kaydedildi</StatusBadge>
                <p className="text-sm">Ayarlar veritabanına kaydedildi.</p>
              </>}
              {planResults.map((result) => (
                <div key={result.key} className="space-y-1">
                  <StatusBadge tone={result.ok ? "success" : "warning"}>
                    {result.key === "status" ? "Kapı durum planı" : "Doğrulama planı"}
                    {result.ok ? ": Cihaza uygulandı" : ": Cihaza uygulanamadı"}
                  </StatusBadge>
                  {!result.ok && <p className="text-sm">{errorMessage(result.error || "Cihazdan başarılı sonuç alınamadı; cihazdaki durum doğrulanamadı.")}</p>}
                </div>
              ))}
              {isSubmitting && <p className="text-sm">Planlar cihaza gönderiliyor…</p>}
            </div>
  );
}
