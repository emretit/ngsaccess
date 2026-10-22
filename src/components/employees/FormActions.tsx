import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormActionsProps {
  isLoading: boolean;
  busyLabel?: string;
  onClose: () => void;
  cancelLabel?: string;
  className?: string;
}

export default function FormActions({ isLoading, busyLabel = "Kaydediliyor", onClose, cancelLabel = "Vazgeç", className }: FormActionsProps) {
  return (
    <div className={cn("sticky bottom-0 flex justify-end gap-3 border-t bg-background px-5 py-3", className)}>
      <Button
        className="max-sm:min-h-11"
        variant="outline"
        disabled={isLoading}
        onClick={onClose}
        type="button"
      >
        {cancelLabel}
      </Button>
      <Button className="max-sm:min-h-11" type="submit" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            {busyLabel}
          </>
        ) : (
          "Kaydet"
        )}
      </Button>
    </div>
  );
}
