import { useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { ServerDevice } from "@/types/device";
import { usePermissions } from "@/hooks/usePermissions";
import { notify } from "@/lib/notify";
import { ConfirmAction } from "@/components/shared/ConfirmAction";
import { ListSelectAll } from "@/components/shared/ListSelectAll";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  defaultPersonSelection,
  importResultText,
  personImportSelection,
  personSelectionState,
  selectablePersons,
  showFingerprintConsent,
  togglePersonSelection,
  type DeviceImportPreview,
  type DeviceImportResult,
  isPersonImportDevice,
} from "./devicePersonImportView";
import { useQuery } from "convex/react";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useNow } from "@/hooks/useNow";
import { deviceConnection } from "@/lib/deviceStatus";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function DevicePersonImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { can } = usePermissions();
  const { projectId } = useActiveProjectScope();
  const devices = useQuery(api.devices.list, open && projectId && can("devices.manage") && can("employees.manage") ? { projectId } : "skip");
  const now = useNow(15_000);
  const [selectedId, setSelectedId] = useState("");
  const pending = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const eligible = devices?.filter(isPersonImportDevice) ?? [];
  const device = eligible.find((item) => item._id === selectedId) ?? (eligible.length === 1 ? eligible[0] : undefined);
  return <Dialog open={open} onOpenChange={(next) => {
    if (!pending.current) { if (!next) setSelectedId(""); onOpenChange(next); }
  }}>
    <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto min-w-0 [&_button]:min-h-11 md:[&_button]:min-h-0"
      onEscapeKeyDown={(event) => { if (pending.current) event.preventDefault(); }}
      onInteractOutside={(event) => { if (pending.current) event.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle>Cihazdan kişileri çek</DialogTitle>
        <DialogDescription>Seçtiğiniz kişiler ngsplus'a eklenir; cihazdaki kişiler silinmez.</DialogDescription>
      </DialogHeader>
      {!can("devices.manage") || !can("employees.manage") ? <p>Bu işlem için kişi ve cihaz yönetimi yetkisi gerekir.</p> :
        devices === undefined ? <SectionSkeleton label="Cihazlar yükleniyor" /> :
        eligible.length === 0 ? <p>Bu projede kişi çekilebilecek Hikvision cihazı yok.</p> : <>
          <label className="space-y-1 text-sm">Cihaz
            <NativeSelect disabled={isPending} className="min-h-11" value={device?._id ?? ""} onChange={(event) => { if (!pending.current) setSelectedId(event.target.value); }}>
              <option value="" disabled>Cihaz seçin</option>
              {eligible.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </NativeSelect>
          </label>
          {open && device && <PersonImport key={device._id} device={device} connected={deviceConnection(device, now) === "online"} canBiometrics={can("biometrics.manage")} onPendingChange={(value) => { pending.current = value; setIsPending(value); }}
            onImported={(result) => {
              // Aktarım bitti: ilerleme penceresi ve bu diyalog birlikte kapanır, sonuç bildirimde görünür.
              pending.current = false; setIsPending(false); setSelectedId("");
              onOpenChange(false);
              notify.success("Aktarım tamamlandı", importResultText(result, device.name ?? "Cihaz"));
            }} />}
        </>}
    </DialogContent>
  </Dialog>;
}

const statuses = {
  new: { label: "Yeni", tone: "info" },
  matched: { label: "Zaten kayıtlı", tone: "success" },
  conflict: { label: "Çakışma", tone: "danger" },
  manual: { label: "Elle eşleştir", tone: "warning" },
} as const;
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";

function PersonImport({ device, connected, canBiometrics, onPendingChange, onImported }: {
device: ServerDevice; connected: boolean; canBiometrics: boolean; onPendingChange: (pending: boolean) => void;
onImported: (result: DeviceImportResult) => void;
}) {
  const previewPersons = useAction(
    api.actions.hikDeviceImport.previewDeviceImport,
  );
  const importPersons = useAction(
    api.actions.hikDeviceImport.importDevicePersons,
  );
  const [preview, setPreview] = useState<DeviceImportPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"preview" | "import" | null>(
    null,
  );
  const running = useRef(false);
  const [confirmation, setConfirmation] = useState<"import" | null>(
    null,
  );
  const disabled = !connected || busy !== null;
  const newRows = selectablePersons(preview);
  const hasFingerprints = showFingerprintConsent(
    preview,
    selected,
    canBiometrics,
  );
  const importSelection = personImportSelection(
    preview,
    selected,
    canBiometrics,
    consent,
  );
  const selectedNos = importSelection.employeeNos;

  async function readPreview() {
    const result = await previewPersons({ deviceId: device._id });
    setPreview(result);
    setSelected(defaultPersonSelection(result));
    setConsent(false);
  }
  async function showPreview() {
    if (disabled || running.current) return;
    running.current = true;
    onPendingChange(true);
    setBusy("preview");
    try {
      await readPreview();
    } catch (error) {
      notify.error("Cihaz okunamadı", errorMessage(error));
    } finally {
      running.current = false;
      setBusy(null);
      onPendingChange(false);
    }
  }
  async function doImport() {
    if (disabled || running.current || selectedNos.length === 0)
      return false;
    running.current = true;
    onPendingChange(true);
    setBusy("import");
    try {
      const result = await importPersons({
        deviceId: device._id,
        ...importSelection,
      });
      setConfirmation(null);
      onImported(result);
      return true;
    } catch (error) {
      notify.error("Aktarım tamamlanamadı", errorMessage(error));
      return false;
    } finally {
      running.current = false;
      setBusy(null);
      onPendingChange(false);
    }
  }
  function togglePerson(employeeNo: string) {
    if (disabled) return;
    setSelected((current) => togglePersonSelection(current, employeeNo));
    setConsent(false);
  }
  return <section className="min-w-0 space-y-3">
    {!connected && <p role="status" className="text-sm text-warning">Cihaz çevrimdışı — aktarım yapılamaz</p>}
        <div className="min-w-0 space-y-3">
          <h5 className="text-sm font-medium">Kişileri aktar</h5>
          <Button variant="outline" disabled={disabled} onClick={showPreview}>
            Cihazdaki kişileri göster
          </Button>
          {busy === "preview" && (
            <>
              <p role="status" className="text-sm">
                Cihaz okunuyor… kişi sayısına göre 1 dakikayı bulabilir.
              </p>
              <SectionSkeleton rows={3} label="Cihazdaki kişiler yükleniyor" />
            </>
          )}
          {preview && (
            <>
              <p className="text-sm">
                Cihazda {preview.totals.persons} kişi, {preview.totals.cards}{" "}
                kart.
              </p>
              {preview.truncated && (
                <p role="status" className="text-sm text-warning">
                  İlk 1000 kişi gösteriliyor.
                </p>
              )}
              <div className="min-w-0 max-w-full">
                <Table
                  className="table-fixed [&_th]:px-1"
                  aria-label="Cihazdaki kişiler"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <ListSelectAll
                          label="Tüm yeni kişileri seç"
                          disabled={disabled || newRows.length === 0}
                          checked={personSelectionState(preview, selected)}
                          onChange={(checked) => {
                            setSelected(
                              checked
                                ? newRows.map((row) => row.employeeNo)
                                : [],
                            );
                            setConsent(false);
                          }}
                        />
                      </TableHead>
                      <TableHead className="break-words">
                        Cihaz kişi no
                      </TableHead>
                      <TableHead>Ad</TableHead>
                      <TableHead>Kart</TableHead>
                      <TableHead className="break-words">Parmak izi</TableHead>
                      <TableHead>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow
                        key={row.employeeNo}
                        className={
                          row.status === "new" && !disabled
                            ? "cursor-pointer"
                            : undefined
                        }
                        onClick={() => {
                          if (row.status === "new")
                            togglePerson(row.employeeNo);
                        }}
                      >
                        <TableCell className="px-2">
                          <Checkbox
                            aria-label={`${row.name} seç`}
                            checked={selected.includes(row.employeeNo)}
                            disabled={disabled || row.status !== "new"}
                            onClick={(event) => event.stopPropagation()}
                            onCheckedChange={() => togglePerson(row.employeeNo)}
                          />
                        </TableCell>
                        <TableCell className="break-all px-1">
                          {row.employeeNo}
                        </TableCell>
                        <TableCell className="break-words px-1">
                          {row.name}
                        </TableCell>
                        <TableCell className="break-all px-1">
                          {row.cards.length ? row.cards.join(", ") : "Kartsız"}
                        </TableCell>
                        <TableCell className="px-1">
                          {row.fingerCount || "—"}
                        </TableCell>
                        <TableCell className="break-words px-1">
                          <StatusBadge
                            className="max-w-full whitespace-normal"
                            tone={statuses[row.status].tone}
                          >
                            {statuses[row.status].label}
                          </StatusBadge>
                          {row.reason && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.reason}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {newRows.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aktarılacak yeni kişi yok.
                </p>
              )}
              {!canBiometrics && (
                <p className="text-sm text-muted-foreground">
                  Parmak izi yetkiniz yok; kişiler parmak izi olmadan aktarılır.
                </p>
              )}
              {canBiometrics && hasFingerprints && (
                <div className="space-y-1">
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      className="mt-0.5"
                      disabled={disabled}
                      checked={consent}
                      onCheckedChange={(checked) =>
                        setConsent(checked === true)
                      }
                    />
                    Seçilen kişilerin parmak izi açık rızası alınmıştır
                  </label>
                  {!consent && (
                    <p className="text-xs text-muted-foreground">
                      İşaretlemezseniz kişiler parmak izi olmadan aktarılır.
                    </p>
                  )}
                </div>
              )}
              <Button
                disabled={disabled || selectedNos.length === 0}
                onClick={() => setConfirmation("import")}
              >
                Seçilenleri aktar ({selectedNos.length})
              </Button>
            </>
          )}
        </div>
      <AlertDialog open={busy === "import"}>
        <AlertDialogContent aria-busy onEscapeKeyDown={(event) => event.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Kişiler aktarılıyor</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedNos.length} kişi ngsplus'a ekleniyor{importSelection.biometricConsentConfirmed ? " ve parmak izleri cihazdan okunuyor" : ""}. Birkaç dakika sürebilir; pencereyi kapatmayın.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <LoadingSpinner size="sm" text="" inline className="py-2" />
        </AlertDialogContent>
      </AlertDialog>
      <ConfirmAction
        open={confirmation === "import"}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null);
        }}
        title="Kişiler aktarılsın mı?"
        description={`${selectedNos.length} kişi ngsplus'a eklenecek ve '${device.name ?? "Cihaz"} mevcut kişiler' erişim kuralına bağlanacak. Cihazdaki kişiler silinmez.`}
        confirmLabel="Aktar"
        onConfirm={() => {
          // Onay penceresi hemen kapanır; ilerleme ayrı pencerede görünür.
          setConfirmation(null);
          return doImport();
        }}
      />
</section>;
}
