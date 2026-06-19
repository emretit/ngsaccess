import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

export const useGeneralSettings = () => {
  const { toast } = useToast();
  const { projectId, loading: projectLoading } = useActiveProject();

  const settings = useQuery(
    api.settings.getGeneral,
    !projectLoading && projectId ? { projectId } : "skip",
  );
  const upsertGeneral = useMutation(api.settings.upsertGeneral);

  const saveSettings = async (data: {
    companyName?: string;
    address?: string;
    email?: string;
    phone?: string;
    website?: string;
    taxNumber?: string;
    currency?: string;
    logoUrl?: string;
    darkMode?: boolean;
    dateFormat?: string;
    timezone?: string;
    systemLanguage?: string;
    workingDays?: string[];
    workingHoursStart?: string;
    workingHoursEnd?: string;
    notificationsEnabled?: boolean;
  }) => {
    if (!projectId) {
      toast({
        title: "Hata",
        description: "Önce bir proje seçin.",
        variant: "destructive",
      });
      return false;
    }
    try {
      await upsertGeneral({
        projectId,
        companyName: data.companyName ?? settings?.companyName ?? "NGS Access",
        ...data,
      });
      toast({ title: "Başarılı", description: "Genel ayarlar kaydedildi." });
      return true;
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Ayarlar kaydedilirken hata oluştu.",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    settings: settings ?? null,
    loading: projectLoading || (!!projectId && settings === undefined),
    saving: false,
    saveSettings,
  };
};
