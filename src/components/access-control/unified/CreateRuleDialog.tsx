
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useRuleForm } from "./hooks/useRuleForm";
import { RuleBasicInfo } from "./components/RuleBasicInfo";
import { DepartmentTree } from "./components/DepartmentTree";
import { ZoneDeviceTree } from "./components/ZoneDeviceTree";
import { TimeSchedule } from "./components/TimeSchedule";

interface CreateRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule?: any;
  onClose: () => void;
}

const CreateRuleDialog = ({ open, onOpenChange, editingRule, onClose }: CreateRuleDialogProps) => {
  const { formData, setFormData, handleSubmit, isSubmitting } = useRuleForm(editingRule, open, onClose);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRule ? 'Erişim Kuralını Düzenle' : 'Yeni Erişim Kuralı'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <RuleBasicInfo formData={formData} setFormData={setFormData} />

          <div className="grid grid-cols-2 gap-6">
            <DepartmentTree formData={formData} setFormData={setFormData} />
            <ZoneDeviceTree formData={formData} setFormData={setFormData} />
          </div>

          <TimeSchedule formData={formData} setFormData={setFormData} />

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingRule ? 'Güncelleniyor...' : 'Oluşturuluyor...'}
                </>
              ) : (
                editingRule ? 'Güncelle' : 'Oluştur'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRuleDialog;
