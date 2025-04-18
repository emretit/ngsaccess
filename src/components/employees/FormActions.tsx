
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface FormActionsProps {
  isLoading: boolean;
  onClose: () => void;
}

export default function FormActions({ isLoading, onClose }: FormActionsProps) {
  return (
    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
      <Button variant="outline" onClick={onClose} type="button">
        İptal
      </Button>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Kaydediliyor
          </>
        ) : (
          'Kaydet'
        )}
      </Button>
    </div>
  );
}
