import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UseFormReturn } from "react-hook-form";
import type { FormValues } from "../hooks/useDeviceFormSchema";
import {
  HIK_MODELS,
  MANUAL_MODEL_ID,
  getHikModelSpec,
} from "../../../../convex/lib/hikModels";

interface DeviceHikModelFieldProps {
  form: UseFormReturn<FormValues>;
}

/**
 * Hikvision cihaz modeli seçimi — kapı/okuyucu sayısı buradan türetilir. Cihaz adından
 * hemen sonra render edilir (hem yeni hem düzenleme) çünkü model topolojiyi belirler ve
 * ilk seçilmesi gerekir. Model seçilince transport ipucu uygulanır ve kapı sayısı modele
 * sabitlenir; "Diğer (manuel)" kapı sayısı inputunu açar.
 */
export function DeviceHikModelField({ form }: DeviceHikModelFieldProps) {
  const selectedModel = form.watch("hik_model");
  const modelSpec = getHikModelSpec(selectedModel);
  const isManualModel = selectedModel === MANUAL_MODEL_ID;

  return (
    <>
      <FormField
        control={form.control}
        name="hik_model"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cihaz Modeli</FormLabel>
            <Select
              value={field.value ?? ""}
              onValueChange={(value) => {
                field.onChange(value);
                const spec = getHikModelSpec(value);
                if (spec?.transportHint) {
                  form.setValue("hik_transport", spec.transportHint);
                }
                // Katalog modelinde kapı sayısı modelden gelir → alanı modelin sayısına
                // sabitle (boşaltma değil): düzenlemede kaydedince localBridge hikDoorCount'u
                // varsayılana (4) düşürmesin; manuel modelde kullanıcının girdiği korunur.
                if (spec) {
                  form.setValue("hik_door_count", spec.doorCount);
                }
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Model seçin" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {HIK_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
                <SelectItem value={MANUAL_MODEL_ID}>Diğer (manuel)</SelectItem>
              </SelectContent>
            </Select>
            {modelSpec && (
              <p className="text-xs text-muted-foreground">
                {modelSpec.doorCount} kapı ·{" "}
                {modelSpec.doorCount * modelSpec.defaultReadersPerDoor} okuyucu
                {modelSpec.maxReadersPerDoor > 1
                  ? " · kapı başına 2. okuyucu sonradan eklenebilir"
                  : ""}
              </p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      {isManualModel && (
        <FormField
          control={form.control}
          name="hik_door_count"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kapı Sayısı</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="4"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}
