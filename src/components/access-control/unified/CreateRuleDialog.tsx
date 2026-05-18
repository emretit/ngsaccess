
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useRuleForm } from "./hooks/useRuleForm";
import { RuleBasicInfo } from "./components/RuleBasicInfo";
import { DepartmentTree } from "./components/DepartmentTree";
import { ZoneDeviceTree } from "./components/ZoneDeviceTree";
import { TimeSchedule } from "./components/TimeSchedule";
import type { AccessRule } from "@/types/access-control";

interface CreateRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule?: AccessRule | null;
  onClose: () => void;
}

const FORM_ID = "access-rule-form";

const CreateRuleDialog = ({ open, onOpenChange, editingRule, onClose }: CreateRuleDialogProps) => {
  const { formData, setFormData, handleSubmit, isSubmitting } = useRuleForm(editingRule, open, onClose);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle>
            {editingRule ? 'Erişim Kuralını Düzenle' : 'Yeni Erişim Kuralı'}
          </DialogTitle>
        </DialogHeader>

        <form id={FORM_ID} onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <RuleBasicInfo formData={formData} setFormData={setFormData} />
          <TimeSchedule formData={formData} setFormData={setFormData} />

          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 pt-2 border-t">
            <DepartmentTree formData={formData} setFormData={setFormData} />
            <ZoneDeviceTree formData={formData} setFormData={setFormData} />
          </div>
        </form>

        <DialogFooter className="px-6 py-3 border-t bg-background">
          <Button type="button" variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {editingRule ? 'Güncelleniyor...' : 'Oluşturuluyor...'}
              </>
            ) : (
              editingRule ? 'Güncelle' : 'Oluştur'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRuleDialog;
