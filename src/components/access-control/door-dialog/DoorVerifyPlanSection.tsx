import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";

export type VerifyPlanState = { enabled: boolean; beginTime: string; endTime: string; verifyMode: string };

const VERIFY_MODES: { value: string; label: string }[] = [
  { value: "card", label: "Kart" },
  { value: "face", label: "Yüz" },
  { value: "fp", label: "Parmak İzi" },
  { value: "cardOrFace", label: "Kart veya Yüz" },
  { value: "cardAndPw", label: "Kart + Şifre" },
  { value: "cardAndFace", label: "Kart + Yüz" },
];

export function DoorVerifyPlanSection({ verifyPlan, setVerifyPlan, isSubmitting, saved, timeErrors }: {
  verifyPlan: VerifyPlanState; setVerifyPlan: Dispatch<SetStateAction<VerifyPlanState>>;
  isSubmitting: boolean; saved: boolean; timeErrors: Record<string, string>;
}) {
  return (<>
                  {/* Doğrulama Modu Planı */}
                  <div className="rounded-md border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="verify-enabled" className="text-sm font-medium">Doğrulama Modu Planı</Label>
                      <Switch
                        disabled={isSubmitting || saved}
                        id="verify-enabled"
                        checked={verifyPlan.enabled}
                        onCheckedChange={(checked) =>
                          setVerifyPlan((p) => ({ ...p, enabled: checked }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormFieldWrapper htmlFor="verify-beginTime" label="Başlangıç (TR saati)" error={timeErrors["verify-beginTime"]}>
                        <Input
                          id="verify-beginTime"
                          type="time"
                          step={60}
                          value={verifyPlan.beginTime.slice(0, 5)}
                          onChange={(e) =>
                            setVerifyPlan((p) => ({
                              ...p,
                              beginTime: e.target.value,
                            }))
                          }
                        />
                      </FormFieldWrapper>
                      <FormFieldWrapper htmlFor="verify-endTime" label="Bitiş (TR saati)" error={timeErrors["verify-endTime"]}>
                        <Input
                          id="verify-endTime"
                          type="time"
                          step={60}
                          value={verifyPlan.endTime.slice(0, 5)}
                          onChange={(e) =>
                            setVerifyPlan((p) => ({
                              ...p,
                              endTime: e.target.value,
                            }))
                          }
                        />
                      </FormFieldWrapper>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="verify-mode" className="text-xs">Doğrulama Modu</Label>
                      <Select
                        disabled={isSubmitting || saved}
                        value={verifyPlan.verifyMode}
                        onValueChange={(v) =>
                          setVerifyPlan((p) => ({ ...p, verifyMode: v }))
                        }
                      >
                        <SelectTrigger id="verify-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VERIFY_MODES.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
  </>);
}
