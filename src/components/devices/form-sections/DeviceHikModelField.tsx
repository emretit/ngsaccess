import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
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
import { topologyPreview } from "../topologyPreview";

interface DeviceHikModelFieldProps {
  form: UseFormReturn<FormValues>;
  isEdit?: boolean;
}

/**
 * Hikvision cihaz modeli seçimi — kapı/okuyucu sayısı buradan türetilir. Cihaz adından
 * hemen sonra render edilir (hem yeni hem düzenleme) çünkü model topolojiyi belirler ve
 * ilk seçilmesi gerekir. Model seçilince transport ipucu uygulanır ve kapı sayısı modele
 * sabitlenir; "Diğer (manuel)" kapı sayısı inputunu açar.
 */
export function DeviceHikModelField({ form, isEdit }: DeviceHikModelFieldProps) {
  const selectedModel = form.watch("hik_model");
  const isManualModel = selectedModel === MANUAL_MODEL_ID;

  return (
    <>
      <FormField
        control={form.control}
        name="hik_model"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cihaz modeli</FormLabel>
            <Select
              value={field.value ?? ""}
              onValueChange={(value) => {
                field.onChange(value);
                const spec = getHikModelSpec(value);
                if (!isEdit && spec?.transportHint) {
                  form.setValue("hik_transport", spec.transportHint);
                }
                // Katalog modelinde kapı sayısı modelden gelir → alanı modelin sayısına
                // sabitle (boşaltma değil): düzenlemede kaydedince localBridge hikDoorCount'u
                // varsayılana (4) düşürmesin; manuel modelde kullanıcının girdiği korunur.
                if (!isEdit && spec) {
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
            {(isEdit || selectedModel) && (
              <FormDescription className="text-xs">
                {isEdit
                  ? "Model etiketi değiştirilebilir; mevcut kapı/okuyucular ve iletişim yöntemi korunur."
                  : topologyPreview(form.watch())}
              </FormDescription>
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
              <FormLabel>Kapı sayısı</FormLabel>
              <FormControl>
                <Input
                  disabled={isEdit}
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
