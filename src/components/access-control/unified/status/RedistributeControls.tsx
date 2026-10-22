import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  confirmationText,
  failedConfirmationText,
  countText,
  type Counts,
  type Pair,
} from "./model";
import type { useRedistribution } from "./useRedistribution";

type RedistributeControlsProps = Pick<
  ReturnType<typeof useRedistribution>,
  "action" | "setAction" | "sending" | "send"
> & {
  selected: Pair[];
  projectCounts: Counts | null;
  error: string;
  setError: (error: string) => void;
};

export function RedistributeBar({
  selected,
  sending,
  projectCounts,
  setError,
  setAction,
}: Pick<
  RedistributeControlsProps,
  "selected" | "sending" | "projectCounts" | "setError" | "setAction"
>) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        className="whitespace-normal h-auto min-h-10"
        disabled={!selected.length || sending}
        onClick={() => {
          setError("");
          setAction("selected");
        }}
      >
        Seçilileri yeniden dağıt ({selected.length}/100)
      </Button>
      <Button
        className="whitespace-normal h-auto min-h-10"
        variant="outline"
        disabled={sending || !projectCounts?.failed}
        onClick={() => {
          setError("");
          setAction("failed");
        }}
      >
        Hatalıları yeniden dağıt ({countText(projectCounts?.failed ?? 0, projectCounts?.capped ?? false)})
      </Button>
      <Button
        className="whitespace-normal h-auto min-h-10"
        variant="outline"
        disabled={sending || !projectCounts}
        onClick={() => {
          setError("");
          setAction("all");
        }}
      >
        Tümünü yeniden dağıt
      </Button>
    </div>
  );
}

export function RedistributeDialog({
  action,
  setAction,
  sending,
  send,
  selected,
  projectCounts,
  error,
  setError,
}: RedistributeControlsProps) {
  return (
    <Dialog
      open={!!action}
      onOpenChange={(open) => {
        if (!open && !sending) {
          setAction(null);
          setError("");
        }
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeniden dağıtım onayı</DialogTitle>
          <DialogDescription>
            {action === "failed"
              ? failedConfirmationText(projectCounts?.failed ?? 0, projectCounts?.capped ?? false)
              : confirmationText(
                  action === "selected"
                    ? selected.length
                    : countText(projectCounts?.all ?? 0, projectCounts?.capped ?? false),
                )}
          </DialogDescription>
        </DialogHeader>
        {action !== "selected" && (
          <p className="text-sm">
            {action === "failed"
              ? "Projedeki hatalı kayıtlar indeks sırasıyla değerlendirilir (tur başına en çok 100)."
              : "Projenin tüm yetkili kişi ve cihazları değerlendirilir. Görünen sayı kayıt ve bilinmeyen çiftlerin toplamıdır; gerçek kapsam güncel yetkilere göre belirlenir."}{" "}
            Liste filtreleri gönderim kapsamını daraltmaz.
          </p>
        )}
        {error && (
          <p role="alert" className="text-danger break-words">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={sending}
            onClick={() => {
              setAction(null);
              setError("");
            }}
          >
            Vazgeç
          </Button>
          <Button disabled={sending} onClick={() => void send()}>
            {sending ? "Başlatılıyor…" : "Onayla ve gönder"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
