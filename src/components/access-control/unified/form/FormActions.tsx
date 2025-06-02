
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";

interface FormActionsProps {
  onCancel: () => void;
  isCreating: boolean;
}

export function FormActions({ onCancel, isCreating }: FormActionsProps) {
  return (
    <div className="flex flex-col-reverse md:flex-row items-center justify-end gap-4 pt-8 mt-6 border-t border-gray-200 dark:border-gray-700">
      <Button
        type="button"
        variant="outline"
        className="w-full md:w-auto"
        onClick={onCancel}
        disabled={isCreating}
      >
        İptal
      </Button>
      <Button
        type="submit"
        className="flex gap-2 items-center w-full md:w-auto"
        disabled={isCreating}
      >
        {isCreating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {isCreating ? "Kaydediliyor..." : "Kaydet"}
      </Button>
    </div>
  );
}
