import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { BiometricModuleCard } from "./privacy/BiometricModuleCard";
import { BiometricDestructionCard } from "./privacy/BiometricDestructionCard";
import { RetentionAssistantCard } from "./privacy/RetentionAssistantCard";

export function PrivacySettings() {
  const { projectId } = useActiveProjectScope();
  if (!projectId) return null;
  return <div className="space-y-8">
    <BiometricModuleCard projectId={projectId} />
    <RetentionAssistantCard projectId={projectId} />
    <BiometricDestructionCard projectId={projectId} />
  </div>;
}
