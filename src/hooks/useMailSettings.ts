import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useProjectAccess } from "./useProjectAccess";
import { Id } from "../../convex/_generated/dataModel";

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
  const { projectIds } = useProjectAccess();
  const projectId = projectIds[0] as Id<"projects"> | undefined;

  const mailSettings = useQuery(api.settings.getMail, { projectId });
  const upsertMail = useMutation(api.settings.upsertMail);

  const saveMailSettings = async (settings: MailSettingsInput) => {
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
    isLoading: mailSettings === undefined,
    saveMailSettings,
    isSaving: false,
  };
}
