
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface FormHeaderProps {
  onClose: () => void;
  disabled: boolean;
}

export function FormHeader({ onClose, disabled }: FormHeaderProps) {
  return (
    <div className="px-10 py-7 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-[#FAE8E8] to-[#F1F0FB] dark:from-[#28213c] dark:to-[#260F19]">
      <div>
        <DialogTitle className="text-2xl font-extrabold tracking-tight text-gray-800 dark:text-white">
          Yeni Kural Oluştur
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground mt-1">
          Personel ve kapı erişim kuralını tanımlayın
        </DialogDescription>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full hover:bg-red-500/90 focus-visible:ring-2 focus-visible:ring-primary"
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        disabled={disabled}
      >
        <X className="w-5 h-5" />
      </Button>
    </div>
  );
}
