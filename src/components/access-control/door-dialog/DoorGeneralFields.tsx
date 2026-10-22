import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DoorGeneralFields({ name, setName, doorCode, setDoorCode, timeErrors }: {
  name: string; setName: (value: string) => void; doorCode: string; setDoorCode: (value: string) => void;
  timeErrors: Record<string, string>;
}) {
  return (<>
              {/* Temel alanlar */}
              <div className="grid gap-2">
                <Label htmlFor="edit-door-name" >
                  Ad *
                </Label>
                <Input
                  id="edit-door-name" aria-invalid={!!timeErrors.name} aria-describedby={timeErrors.name ? "edit-door-name-error" : undefined}
                  value={name}
                  onChange={(e) => setName(e.target.value)}

                  placeholder="Kapı adı"
                  required
                />
                {timeErrors.name && <p id="edit-door-name-error" className="text-xs text-destructive">{timeErrors.name}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-door-code" >
                  Kapı Kodu
                </Label>
                <Input
                  id="edit-door-code"
                  value={doorCode}
                  onChange={(e) => setDoorCode(e.target.value)}

                  placeholder="Kapı kodu (opsiyonel)"
                />
              </div>

  </>);
}
