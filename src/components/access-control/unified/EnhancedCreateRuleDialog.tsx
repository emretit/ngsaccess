import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import type { AccessRule, RuleConflict } from "@/types/access-control";
import { BasicInfoTab } from "./dialog/BasicInfoTab";
import { TargetsTab } from "./dialog/TargetsTab";
import { AccessPointsTab } from "./dialog/AccessPointsTab";
import { ScheduleTab } from "./dialog/ScheduleTab";
import { useEnhancedRuleForm } from "./dialog/useEnhancedRuleForm";

interface EnhancedCreateRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule?: AccessRule;
  onClose: () => void;
}

const EnhancedCreateRuleDialog = ({
  open,
  onOpenChange,
  editingRule,
  onClose,
}: EnhancedCreateRuleDialogProps) => {
  const [activeTab, setActiveTab] = useState("basic");
  const [conflicts] = useState<RuleConflict[]>([]);

  const { formData, setFormData, handleSubmit, isCreating, isUpdating } =
    useEnhancedRuleForm({ open, editingRule, onClose });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRule
              ? "Gelişmiş Erişim Kuralını Düzenle"
              : "Yeni Gelişmiş Erişim Kuralı"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
            <TabsTrigger value="targets">Hedefler</TabsTrigger>
            <TabsTrigger value="access">Erişim Noktaları</TabsTrigger>
            <TabsTrigger value="schedule">Zaman Ayarları</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-6">
            <TabsContent value="basic" className="space-y-4">
              <BasicInfoTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            <TabsContent value="targets" className="space-y-4">
              <TargetsTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            <TabsContent value="access" className="space-y-4">
              <AccessPointsTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <ScheduleTab
                formData={formData}
                setFormData={setFormData}
                conflicts={conflicts}
              />
            </TabsContent>

            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                İptal
              </Button>
              <Button
                type="submit"
                disabled={isCreating || isUpdating}
                className="bg-primary hover:bg-primary/90"
              >
                {isCreating || isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingRule ? "Güncelleniyor..." : "Oluşturuluyor..."}
                  </>
                ) : editingRule ? (
                  "Kuralı Güncelle"
                ) : (
                  "Kural Oluştur"
                )}
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedCreateRuleDialog;
