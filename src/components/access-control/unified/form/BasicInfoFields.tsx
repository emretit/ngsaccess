
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface BasicInfoFieldsProps {
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  isActive: boolean;
  setIsActive: (value: boolean) => void;
  isCreating: boolean;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
}

export function BasicInfoFields({
  name,
  setName,
  description,
  setDescription,
  isActive,
  setIsActive,
  isCreating,
  errors,
  setErrors
}: BasicInfoFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-3">
        <label htmlFor="ruleName" className="text-xs font-semibold text-gray-500 dark:text-gray-300">
          Kural Adı *
        </label>
        <Input
          id="ruleName"
          placeholder="Kural adını girin"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
          }}
          className={`bg-background text-base shadow-sm ${
            errors.name ? "border-red-500" : ""
          }`}
          autoFocus
          required
          disabled={isCreating}
        />
        {errors.name && (
          <span className="text-red-500 text-xs">{errors.name}</span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <label className="font-semibold text-xs text-gray-500 dark:text-gray-300" htmlFor="statusSwitch">
          Durum
        </label>
        <div className="flex items-center gap-2">
          <Switch
            id="statusSwitch"
            checked={isActive}
            onCheckedChange={setIsActive}
            disabled={isCreating}
          />
          <span className="font-semibold text-xs ml-1">
            {isActive ? "Aktif" : "Pasif"}
          </span>
        </div>
      </div>

      <div className="md:col-span-3 flex flex-col gap-3">
        <label htmlFor="description" className="text-xs font-semibold text-gray-500 dark:text-gray-300">
          Açıklama
        </label>
        <Input
          id="description"
          placeholder="Kural açıklaması (isteğe bağlı)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-background text-base shadow-sm"
          disabled={isCreating}
        />
      </div>
    </>
  );
}
