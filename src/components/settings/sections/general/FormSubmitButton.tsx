import { Button } from "@/components/ui/button";

interface FormSubmitButtonProps {
  saving: boolean;
}

export const FormSubmitButton = ({ saving }: FormSubmitButtonProps) => {
  return (
    <div className="flex justify-end pt-4 border-t">
      <Button 
        type="submit" 
        size="lg"
        disabled={saving}
        className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 font-semibold"
      >
        {saving ? "💾 Kaydediliyor..." : "💾 Değişiklikleri Kaydet"}
      </Button>
    </div>
  );
};