import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

interface MailSettingsInput {
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  fromEmail?: string;
  fromName?: string;
  isActive?: boolean;
}

export function useMailSettings() {
  const { toast } = useToast();
  const { projectId, loading: projectLoading } = useActiveProject();

  const mailSettings = useQuery(
    api.settings.getMail,
    !projectLoading && projectId ? { projectId } : "skip",
  );
  const upsertMail = useMutation(api.settings.upsertMail);

  const saveMailSettings = async (settings: MailSettingsInput) => {
    if (!projectId) {
      toast({
        title: "Hata",
        description: "Önce bir proje seçin.",
        variant: "destructive",
      });
      return;
    }
    try {
      await upsertMail({ ...settings, projectId });
      toast({
        title: "Mail ayarları kaydedildi",
        description: "Mail yapılandırması başarıyla güncellendi",
      });
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Mail ayarları kaydedilirken hata oluştu",
        variant: "destructive",
      });
    }
  };

  return {
    mailSettings: mailSettings ?? null,
    isLoading: projectLoading || (!!projectId && mailSettings === undefined),
    saveMailSettings,
    isSaving: false,
  };
}
