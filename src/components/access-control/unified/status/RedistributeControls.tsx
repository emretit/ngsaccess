import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
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
  type GrantRow,
} from "./model";
import type { useRedistribution } from "./useRedistribution";

type RedistributeControlsProps = Pick<
  ReturnType<typeof useRedistribution>,
  "action" | "setAction" | "sending" | "send"
> & {
  selected: Pair[];
  projectName?: string;
  selectedRows?: GrantRow[];
  canManageDevices?: boolean;
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
  canManageDevices = false,
}: Pick<
  RedistributeControlsProps,
  "selected" | "sending" | "projectCounts" | "setError" | "setAction" | "canManageDevices"
>) {
  return (
    <div className="flex flex-wrap gap-2">
      {selected.length > 0 && (
        <div className="flex sticky bottom-2 z-10 bg-background border rounded-md p-2 lg:static lg:border-0 lg:p-0" aria-label="Seçili kayıt işlemleri">
          <Button className="whitespace-normal h-auto min-h-11" disabled={sending} onClick={() => { setError(""); setAction("selected"); }}>
            Seçili {selected.length} kaydı yeniden gönder
          </Button>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="min-h-11" variant="ghost" disabled={sending}>Diğer gönderim işlemleri</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem className="min-h-11" disabled={sending || !projectCounts?.failed} onSelect={() => { setError(""); setAction("failed"); }}>
            Hatalıları yeniden dağıt ({countText(projectCounts?.failed ?? 0, projectCounts?.capped ?? false)})
          </DropdownMenuItem>
          {canManageDevices && <DropdownMenuItem className="min-h-11" disabled={sending || !projectCounts} onSelect={() => { setError(""); setAction("all"); }}>
            Tümünü yeniden dağıt
          </DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
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
  projectName = "Seçili proje",
  selectedRows = [],
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
            {action === "selected"
              ? confirmationText(selected.length)
              : `Tüm proje · filtreler uygulanmaz · ${countText(action === "failed" ? projectCounts?.failed ?? 0 : projectCounts?.all ?? 0, projectCounts?.capped ?? false)} kayıt`}
          </DialogDescription>
        </DialogHeader>
        {action === "selected" && (
          <div className="space-y-2 text-sm break-words">
            <p>Proje: {projectName}</p>
            <ul className="space-y-1">
              {selectedRows.slice(0, 5).map((row) => <li key={`${row.employeeId}:${row.deviceId}`}>{row.employeeName} · {row.deviceName}</li>)}
            </ul>
            {selected.length > 5 && <p>ve {selected.length - 5} kayıt daha</p>}
          </div>
        )}
        {action !== "selected" && (
          <div className="text-sm space-y-2">
            {action === "failed" && (projectCounts?.failed ?? 0) > 100 && <p>{failedConfirmationText(projectCounts?.failed ?? 0, projectCounts?.capped ?? false)}</p>}
            <details>
              <summary className="min-h-11 py-3 cursor-pointer">Ayrıntı</summary>
              <p>{action === "failed"
                ? "Projedeki hatalı kayıtlar sırayla gönderilir (her seferinde en fazla 100 kayıt)."
                : "Projenin tüm yetkili kişi ve cihazları değerlendirilir. Görünen sayı, gönderim bilgisi olmayanlar dahil kişi–cihaz kayıtlarının toplamıdır. Gönderilecek kişiler ve cihazlar güncel kurallara göre belirlenir."}</p>
            </details>
          </div>
        )}
        {error && (
          <p role="alert" className="text-danger break-words">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            variant="outline"
            disabled={sending}
            onClick={() => {
              setAction(null);
              setError("");
            }}
          >
            Vazgeç
          </Button>
          <Button className="min-h-11" disabled={sending} onClick={() => void send()}>
            {sending ? "Başlatılıyor…" : action === "selected" ? `Seçili ${selected.length} kaydı yeniden gönder` : "Onayla ve gönder"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
