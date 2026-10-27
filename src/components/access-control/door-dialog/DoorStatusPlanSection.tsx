import type { Dispatch, SetStateAction, ReactNode } from "react";
import type { DoorStatusPlan } from "../../../../convex/lib/doorStatusPlan";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function DoorStatusPlanSection({ statusPlan, setStatusPlan, isSubmitting, saved, children }: {
  statusPlan: DoorStatusPlan; setStatusPlan: Dispatch<SetStateAction<DoorStatusPlan>>;
  isSubmitting: boolean; saved: boolean; children: ReactNode;
}) {
  return (<>
                  {/* Kapı Durum Planı */}
                  <div className="rounded-md border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="status-enabled" className="text-sm font-medium">Kapı Durum Planı</Label>
                      <Switch
                        disabled={isSubmitting || saved}
                        id="status-enabled"
                        checked={statusPlan.enabled}
                        onCheckedChange={(checked) =>
                          setStatusPlan((p) => ({ ...p, enabled: checked }))
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Kapı modu herkes için geçerlidir. Kişilerin hangi saatlerde geçebileceği Kurallar ve Zaman Şablonları’nda belirlenir.
                      Belirlenen aralıkların dışında kapı normal çalışır; geçişler kişi yetkilerine göre yapılır.
                    </p>
                    {children}
                  </div>

  </>);
}
