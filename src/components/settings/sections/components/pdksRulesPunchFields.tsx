import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Choice } from "./pdksRulesChoice";
import {
  tomorrowInTurkey,
  recommendedPunchRules,
  type PdksRuleValues,
} from "./pdksRulesModel";

export function PdksRulesPunchFields({
  values,
  change,
}: {
  values: PdksRuleValues;
  change: (patch: Partial<PdksRuleValues>) => void;
}) {
  return (
    <>
      <div className="grid gap-4 min-[761px]:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pdks-effective-from">Geçerlilik tarihi</Label>
          <Input
            id="pdks-effective-from"
            type="date"
            min={tomorrowInTurkey()}
            value={values.effectiveFrom}
            onChange={(event) => change({ effectiveFrom: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Türkiye saatine göre en erken yarın.
          </p>
        </div>
        <Choice
          id="pdks-punch-mode"
          label="Okutma kuralı"
          value={values.punchMode}
          options={[
            ["legacy", "Mevcut davranış (değişiklik yok)"],
            ["requirements", "Giriş-çıkış kuralları"],
          ]}
          onChange={(mode) => {
            if (mode === "legacy" || mode === "requirements")
              change({
                punchMode: mode,
                ...(mode === "requirements" ? recommendedPunchRules : {}),
              });
          }}
        />
      </div>
      {values.punchMode === "requirements" && (
        <div className="space-y-4 border-l-2 pl-4">
          <div className="flex flex-wrap gap-5">
            {(["requireCheckIn", "requireCheckOut"] as const).map((key) => (
              <Label key={key} className="flex items-center gap-2">
                <Checkbox
                  checked={values[key]}
                  onCheckedChange={(checked) =>
                    change({ [key]: checked === true })
                  }
                />
                {key === "requireCheckIn" ? "Giriş zorunlu" : "Çıkış zorunlu"}
              </Label>
            ))}
          </div>
          <div className="grid gap-4 min-[761px]:grid-cols-2">
            <Choice
              id="pdks-missing"
              label="Zorunlu okutma eksikse"
              value={values.missingRequiredPunch}
              options={[
                ["review", "İnceleme"],
                ["absent", "Devamsız"],
              ]}
              onChange={(value) => {
                if (value === "review" || value === "absent")
                  change({ missingRequiredPunch: value });
              }}
            />
            <Choice
              id="pdks-no-punch"
              label="Hiç okutma yoksa"
              value={values.noPunch}
              options={[
                ["absent", "Devamsız"],
                ["review", "İnceleme"],
              ]}
              onChange={(value) => {
                if (value === "review" || value === "absent")
                  change({ noPunch: value });
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Tek yönlü günde süre hesaplanamaz. Yön bilgisi olmayan okutmalar
            İnceleme'ye düşer.
          </p>
        </div>
      )}
    </>
  );
}
