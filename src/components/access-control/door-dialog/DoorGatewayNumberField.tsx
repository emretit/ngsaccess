import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DoorGatewayNumberField({ hikDoorNo, setHikDoorNo, timeErrors }: {
  hikDoorNo: string; setHikDoorNo: (value: string) => void; timeErrors: Record<string, string>;
}) {
  return (<>
                  {/* hikDoorNo */}
                  <div className="grid gap-2">
                    <Label htmlFor="hik-door-no" >
                      Kapı No *
                    </Label>
                    <div >
                      <Input
                        id="hik-door-no" aria-invalid={!!timeErrors.hikDoorNo} aria-describedby={timeErrors.hikDoorNo ? "edit-door-number-error" : undefined}
                        type="number"
                        min={1}
                        value={hikDoorNo}
                        onChange={(e) => setHikDoorNo(e.target.value)}
                        placeholder="Cihazdaki fiziksel kapı no (1, 2, ...)"
                        required
                      />
                      {timeErrors.hikDoorNo && <p id="edit-door-number-error" className="text-xs text-destructive">{timeErrors.hikDoorNo}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cihazda bu kapıya atanan fiziksel numara (1'den başlar).
                      </p>
                    </div>
                  </div>

  </>);
}
