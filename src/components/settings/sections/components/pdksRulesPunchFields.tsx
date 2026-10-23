import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-picker";
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
          <DateInput
            id="pdks-effective-from"
            required
            min={tomorrowInTurkey()}
            value={values.effectiveFrom}
            onChange={(effectiveFrom) => change({ effectiveFrom })}
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
      <div className="grid gap-4 min-[761px]:grid-cols-2">
        <Choice id="pdks-calculation-mode" label="Çalışma süresi hesabı"
          value={values.calculationMode ?? "firstLast"}
          options={[["firstLast", "İlk giriş–son çıkış"], ["eachPunch", "Her giriş-çıkışı topla"]]}
          onChange={mode => { if (mode === "firstLast" || mode === "eachPunch") change({ calculationMode: mode }); }} />
        <div className="space-y-2">
          <Label htmlFor="pdks-min-punch-interval">Tekrar okutma aralığı (dk)</Label>
          <Input id="pdks-min-punch-interval" type="number" min={0} max={60} step="any"
            value={values.minPunchIntervalMinutes ?? 1}
            onChange={event => change({ minPunchIntervalMinutes: event.target.value === "" ? NaN : Number(event.target.value) })} />
          <p className="text-xs text-muted-foreground">0–60 dakika. Her giriş-çıkışı topla modunda aynı yönlü tekrarları eler.</p>
        </div>
      </div>
      {values.calculationMode === "eachPunch" && <p className="text-xs text-muted-foreground">Ara çıkışlar çalışma süresinden düşülür; ayrıca otomatik mola düşülmez. Yönsüz okutmalar dönüşümlü giriş ve çıkış sayılır.</p>}
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
            {values.calculationMode === "eachPunch" ? "Tamamlanan giriş-çıkış çiftleri toplanır; eksik çiftler seçilen kurala göre değerlendirilir." : "Tek yönlü günde süre hesaplanamaz. Yön bilgisi olmayan okutmalar İnceleme'ye düşer."}
          </p>
        </div>
      )}
    </>
  );
}
