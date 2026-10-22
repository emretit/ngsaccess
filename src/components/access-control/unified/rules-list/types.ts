import type { AccessRule } from "@/types/access-control";
export interface Props {
  onCreateRule: () => void;
  onEditRule?: (rule: AccessRule) => void;
}
