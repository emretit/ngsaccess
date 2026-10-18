import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";

export const useGeneralSettings = () => {
  const { projectId, loading: projectLoading, isAdmin } = useActiveProjectScope();

  const settings = useQuery(
    api.settings.getGeneral,
    !projectLoading && isAdmin && projectId ? { projectId } : "skip",
  );
  const upsertGeneral = useMutation(api.settings.upsertGeneral);

  const { run: saveSettings, pending: saving } = useAsyncAction(async (data: {
    companyName?: string;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    taxNumber?: string | null;
    currency?: string | null;
    logoUrl?: string | null;
    darkMode?: boolean;
    dateFormat?: string;
    timezone?: string;
    systemLanguage?: string;
    workingDays?: string[];
    workingHoursStart?: string;
    workingHoursEnd?: string;
    notificationsEnabled?: boolean;
  }) => {
    if (!isAdmin || !projectId || projectLoading || settings === undefined) throw new Error("Ayarlar yüklenmeden kaydedilemez. Önce bir proje seçin.");
    await upsertGeneral({ ...data, projectId });
  }, { success: "Genel ayarlar kaydedildi", error: "Genel ayarlar kaydedilemedi" });

  return {
    settings: settings ?? null,
    loading: projectLoading || (!!projectId && settings === undefined),
    saving,
    saveSettings,
  };
};
