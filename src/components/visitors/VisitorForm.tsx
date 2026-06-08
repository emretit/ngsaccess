import { useState } from "react";
import { Visitor } from "@/types/visitor";
import { Loader2 } from "lucide-react";
import FormActions from "@/components/employees/FormActions";
import VisitorFormFields from "./VisitorFormFields";
import { useVisitorFormData } from "./hooks/useVisitorFormData";
import { useVisitorFormSubmit } from "./hooks/useVisitorFormSubmit";
import { visitorFormSchema } from "./hooks/useVisitorFormSchema";

interface VisitorFormProps {
  visitor?: Visitor | null;
  onClose: () => void;
  onSave: (payload?: unknown) => void;
}

export default function VisitorForm({ visitor, onClose, onSave }: VisitorFormProps) {
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const { formData, setFormData, presetRules, hostEmployees, optionsLoading } =
    useVisitorFormData(visitor);
  const { isLoading, handleSubmit } = useVisitorFormSubmit(visitor, onClose, onSave);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = visitorFormSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    handleSubmit(formData);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
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
          errors={fieldErrors}
        />
      )}

      <FormActions isLoading={isLoading || optionsLoading} onClose={onClose} />
    </form>
  );
}
