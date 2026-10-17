import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface FormActionsProps {
  isLoading: boolean;
  onClose: () => void;
}

export default function FormActions({ isLoading, onClose }: FormActionsProps) {
  return (
    <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background px-5 py-4">
      <Button
        variant="outline"
        disabled={isLoading}
        onClick={onClose}
        type="button"
      >
        Vazgeç
      </Button>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Kaydediliyor
          </>
        ) : (
          "Kaydet"
        )}
      </Button>
    </div>
  );
}
