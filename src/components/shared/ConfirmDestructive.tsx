import { AsyncConfirmation } from "@/components/shared/ConfirmAction";

export interface ConfirmDestructiveProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  objectName: string;
  effects: string[];
  confirmLabel: string;
  errorTitle?: string;
  onConfirm: () => Promise<unknown>;
}

export function ConfirmDestructive({
  open,
  onOpenChange,
  title,
  objectName,
  effects,
  confirmLabel,
  errorTitle,
  onConfirm,
}: ConfirmDestructiveProps) {
  return (
    <AsyncConfirmation
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      confirmLabel={confirmLabel}
      errorTitle={errorTitle}
      onConfirm={onConfirm}
      variant="destructive"
      description={
        <>
          <p className="font-medium text-foreground">{objectName}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {effects.map((effect, index) => (
              <li key={index}>{effect}</li>
            ))}
          </ul>
        </>
      }
    />
  );
}
