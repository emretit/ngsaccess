
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCallback } from "react";

interface BasicInfoFieldsProps {
  name: string;
  setName: (value: string) => void;
  isActive: boolean;
  setIsActive: (value: boolean) => void;
  isCreating: boolean;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
}

export function BasicInfoFields({
  name,
  setName,
  isActive,
  setIsActive,
  isCreating,
  errors,
  setErrors
}: BasicInfoFieldsProps) {
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
  }, [setName, errors.name, setErrors]);

  const handleStatusChange = useCallback((checked: boolean) => {
    setIsActive(checked);
  }, [setIsActive]);

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
          onChange={handleNameChange}
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
            onCheckedChange={handleStatusChange}
            disabled={isCreating}
          />
          <span className="font-semibold text-xs ml-1">
            {isActive ? "Aktif" : "Pasif"}
          </span>
        </div>
      </div>
    </>
  );
}

export function DescriptionField({
  description,
  setDescription,
  isCreating
}: {
  description: string;
  setDescription: (value: string) => void;
  isCreating: boolean;
}) {
  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  }, [setDescription]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="description" className="text-xs font-semibold text-gray-500 dark:text-gray-300">
        Açıklama
      </label>
      <Textarea
        id="description"
        placeholder="Kural açıklaması (isteğe bağlı)"
        value={description}
        onChange={handleDescriptionChange}
        className="bg-background text-sm shadow-sm resize-none h-12"
        disabled={isCreating}
      />
    </div>
  );
}
