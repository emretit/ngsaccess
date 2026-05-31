import { Visitor } from "@/types/visitor";
import { Loader2 } from "lucide-react";
import FormActions from "@/components/employees/FormActions";
import VisitorFormFields from "./VisitorFormFields";
import { useVisitorFormData } from "./hooks/useVisitorFormData";
import { useVisitorFormSubmit } from "./hooks/useVisitorFormSubmit";

interface VisitorFormProps {
  visitor?: Visitor | null;
  onClose: () => void;
  onSave: (payload?: unknown) => void;
}

export default function VisitorForm({ visitor, onClose, onSave }: VisitorFormProps) {
  const { formData, setFormData, presetRules, hostEmployees, optionsLoading } =
    useVisitorFormData(visitor);
  const { isLoading, handleSubmit } = useVisitorFormSubmit(visitor, onClose, onSave);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(formData);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {optionsLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Form bilgileri yükleniyor...
        </div>
      ) : (
        <VisitorFormFields
          formData={formData}
          setFormData={setFormData}
          presetRules={presetRules}
          hostEmployees={hostEmployees}
          isEditing={!!visitor}
          kvkkConsentAt={visitor?.kvkkConsentAt}
        />
      )}

      <FormActions isLoading={isLoading || optionsLoading} onClose={onClose} />
    </form>
  );
}
