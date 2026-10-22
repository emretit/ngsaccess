import { usePermissions } from "@/hooks/usePermissions";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Button } from "@/components/ui/button";
import { DashboardPanel } from "./DashboardPanel";

type StepKey = FunctionReturnType<typeof api.projects.getSetupStatus>["steps"][number]["key"];
const details: Record<StepKey, { label: string; to: string; hint?: string }> = {
  administrator: { label: "Proje yöneticisi atandı", to: "/settings?tab=users" },
  device: { label: "Cihaz eklendi ve bağlandı", to: "/devices", hint: "Teknik servis gerekebilir: Hikvision gateway için ISUP ayarı, IDE için broker’a alma işlemi gerekir." },
  cardholder: { label: "Aktif çalışan ve kart eklendi", to: "/employees" },
  accessRule: { label: "Erişim yetkisi tanımlandı", to: "/access-control" },
  firstPassage: { label: "İlk başarılı geçiş kaydedildi", to: "/pdks-records" },
};
function isHidden(key: string) {
  try { return typeof window !== "undefined" && window.localStorage.getItem(key) === "1"; }
  catch { return false; }
}

export default function SetupChecklist() {
  const { projectId, loading } = useActiveProject();
  const { can } = usePermissions();
  const canManage = can("admin.manage");
  const storageKey = `ngs.setupChecklist.hidden.${projectId ?? ""}`;
  const doneKey = `ngs.setupChecklist.done.${projectId ?? ""}`;
  const [completedKey, setCompletedKey] = useState<string | null>(null);
  const completed = completedKey === doneKey || isHidden(doneKey);
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);
  const hidden = hiddenKey === storageKey || isHidden(storageKey);
  const status = useQuery(api.projects.getSetupStatus, !loading && canManage && projectId && !hidden && !completed ? { projectId } : "skip");
  useEffect(() => {
    if (!loading && canManage && projectId && !hidden && !completed && status?.complete) {
      try { window.localStorage.setItem(doneKey, "1"); } catch { /* Bu oturumda abonelik kapalı kalır. */ }
      setCompletedKey(doneKey);
    }
  }, [loading, canManage, projectId, hidden, completed, status?.complete, doneKey]);
  if (loading || !canManage || !projectId || hidden || completed || !status || status.complete) return null;
  const dismiss = () => {
    try { window.localStorage.setItem(storageKey, "1"); } catch { /* Bu oturumda gizleme devam eder. */ }
    setHiddenKey(storageKey);
  };
  return <DashboardPanel title="Kurulumu tamamlayın" context={`${status.steps.filter(step => step.done).length}/5 adım tamam`}
    aside={<Button variant="ghost" size="sm" className="min-h-11" onClick={dismiss}>Şimdilik gizle</Button>}>
    <ol className="divide-y px-4 min-[761px]:px-5">
      {status.steps.map(step => <li key={step.key} className="min-w-0 py-3">
        <Link to={details[step.key].to} className="flex min-h-11 min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded text-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <span className="min-w-0 break-words font-medium">{details[step.key].label}</span>
          <span className={step.done ? "text-success" : "text-muted-foreground"}>{step.done ? "Tamam" : "Bekliyor"}</span>
        </Link>
        {details[step.key].hint && <p className="text-xs leading-relaxed text-muted-foreground">{details[step.key].hint}</p>}
        {step.key === "cardholder" && <Link to="/employees" className="inline-flex min-h-11 items-center text-xs underline">Excel içe aktarma için Personel → İçe aktar</Link>}
      </li>)}
    </ol>
  </DashboardPanel>;
}
