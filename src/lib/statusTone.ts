export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "status-success-badge",
  warning: "status-warning-badge",
  danger: "status-danger-badge",
  info: "status-info-badge",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function statusTone(tone: StatusTone): string {
  return toneClasses[tone];
}
