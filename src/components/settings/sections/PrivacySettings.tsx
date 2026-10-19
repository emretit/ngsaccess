import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { VisitorNoticeCard } from "./privacy/VisitorNoticeCard";
import { BiometricModuleCard } from "./privacy/BiometricModuleCard";
import { BiometricDestructionCard } from "./privacy/BiometricDestructionCard";
import { RetentionAssistantCard } from "./privacy/RetentionAssistantCard";

export function PrivacySettings() {
  const { projectId } = useActiveProjectScope();
  if (!projectId) return null;
  // Her kart kendi sınırında: biri hata verirse diğer KVKK ayarları açık kalır (R3-D2).
  return <div className="space-y-8">
    <QuerySectionBoundary resetKey={projectId} title="Ziyaretçi aydınlatma metni yüklenemedi"><VisitorNoticeCard key={projectId} projectId={projectId} /></QuerySectionBoundary>
    <QuerySectionBoundary resetKey={projectId} title="Biyometrik modül ayarı yüklenemedi"><BiometricModuleCard projectId={projectId} /></QuerySectionBoundary>
    <QuerySectionBoundary resetKey={projectId} title="Saklama süresi asistanı yüklenemedi"><RetentionAssistantCard projectId={projectId} /></QuerySectionBoundary>
    <BiometricDestructionCard projectId={projectId} />
  </div>;
}
