import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAdminPrimaryAction } from "./hooks/useAdminPrimaryAction";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { RowActions } from "@/components/shared/RowActions";
import { StatInline } from "@/components/shared/StatInline";
import { FilterBar } from "@/components/shared/FilterBar";
import { notify, errorMessage } from "@/lib/notify";
import { deviceConnection } from "@/lib/deviceStatus";
import { useNow } from "@/hooks/useNow";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import {
  AdminEmptyState as EmptyState,
  focusAdminHeading,
} from "./components/AdminListParts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AdminDataBoundary } from "./components/AdminDataBoundary";
import { AdminDeviceDialog } from "./AdminDeviceDialog";
import { IdeProvisioningCard } from "./IdeProvisioningCard";
import {
  AdminSelect,
  AdminPagination,
  adminDate,
  useAdminPagination,
  useStableAdminPage,
} from "./components/AdminListParts";
import { useAdminFormGuard } from "./hooks/useAdminFormGuard";
import { onRowActivate, ROW_CLICK_CLASS } from "@/lib/tableRowClick";

type AdminDevice = FunctionReturnType<
  typeof api.adminDevices.adminListPage
>["page"][number];
type Filters = Pick<
  FunctionArgs<typeof api.adminDevices.adminListPage>,
  "search" | "assignment" | "connection"
>;
const brandLabel = (brand?: string) =>
  brand === "ide_smart"
    ? "IDE Smart"
    : brand === "hikvision"
      ? "Hikvision"
      : brand === "other"
        ? "Diğer"
        : "—";
function AdminDevicesContent() {
  const now = useNow();
  const [filters, setFilters] = useState<Filters>({});
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const queryFilters = { ...filters, search: debouncedSearch };
  const paging = useAdminPagination(JSON.stringify(queryFilters));
  // paginationOpts.id changes query identity each minute; the backend receives the same filters/cursor.
  const raw = useQuery(api.adminDevices.adminListPage, {
    ...queryFilters,
    paginationOpts: {
      numItems: paging.size,
      cursor: paging.cursor,
      id: filters.connection ? Math.floor(now / 60_000) : 0,
    },
  });
  const result = useStableAdminPage(raw, paging.key);
  const projects = useQuery(api.projects.list, {});
  const [deleteDevice, setDeleteDevice] = useState<AdminDevice | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const [dialog, setDialog] = useState<{ device: AdminDevice | null } | null>(
    null,
  );
  const [provisioning, setProvisioning] = useState(false);
  const remove = useMutation(api.adminDevices.remove);
  const backfill = useMutation(api.adminDevices.backfillExisting);
  const { run: sync, pending: syncing } = useAsyncAction(async () => {
    const count = await backfill({});
    notify.success(
      "Envanter senkronize edildi",
      count === 0
        ? "Tüm cihazlar zaten kayıtlı."
        : `${count} cihaz senkronize edildi.`,
    );
  });
  useAdminFormGuard("admin-inventory-operation", false, deleting || syncing);
  const filtered = Boolean(
    filters.search || filters.assignment || filters.connection,
  );
  const create = () => setDialog({ device: null });
  const primaryInHeader = useAdminPrimaryAction("Cihaz kaydet", create);
  const status = (device: AdminDevice) => {
    const connection = deviceConnection(device, now);
    return (
      <StatusBadge tone={connection === "online" ? "success" : "neutral"}>
        {connection === "online"
          ? "Çevrimiçi"
          : connection === "offline"
            ? "Çevrimdışı"
            : "Henüz görülmedi"}
      </StatusBadge>
    );
  };
  const assignment = (device: AdminDevice) =>
    device.assignedDeviceId
      ? (device.assignedProjectName ?? "Projeye atanmış")
      : "Havuzda";
  const identity = (device: AdminDevice) =>
    device.ideUuid ?? device.deviceSerial ?? "Kimlik bilgisi yok";
  const actions = (device: AdminDevice) => (
    <RowActions label={`${device.name} cihaz işlemleri`}>
      <DropdownMenuItem onSelect={() => setDialog({ device })}>
        Düzenle / proje ataması
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-destructive"
        onSelect={() => {
          setDeleteDevice(device);
          setDeleteError(undefined);
          setDeleteOpen(true);
        }}
      >
        Envanterden kaldır
      </DropdownMenuItem>
    </RowActions>
  );
  return (
    <div className="min-w-0 space-y-5">
      <h2 id="admin-devices-heading" tabIndex={-1} className="sr-only">
        Cihaz havuzu
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatInline
          loading={!result}
          items={[
            { label: "Bu sayfada", value: result?.page.length },
            {
              label: "Havuzda (bu sayfa)",
              value: result?.page.filter((device) => !device.assignedDeviceId)
                .length,
            },
          ]}
        />
        {!primaryInHeader && <Button onClick={create}>Cihaz kaydet</Button>}
      </div>
      <FilterBar
        search={filters.search ?? ""}
        onSearchChange={(search) => setFilters({ ...filters, search })}
        searchLabel="Cihaz ara"
        placeholder="Ad veya kimlik ara"
        hasFilters={filtered}
        onClear={() => setFilters({})}
      >
        <AdminSelect
          label="Proje"
          value={filters.assignment ?? "all"}
          onChange={(value) =>
            setFilters({
              ...queryFilters,
              assignment:
                value === "all" ? undefined : (value as Filters["assignment"]),
            })
          }
        >
          <option value="all">Tümü</option>
          <option value="pool">Havuzda</option>
          <option value="assigned">Projeye atanmış</option>
          {projects?.map((project) => (
            <option key={project._id} value={project._id}>
              {project.name}
            </option>
          ))}
        </AdminSelect>
        <AdminSelect
          label="Bağlantı"
          value={filters.connection ?? "all"}
          onChange={(value) =>
            setFilters({
              ...queryFilters,
              connection:
                value === "all" ? undefined : (value as Filters["connection"]),
            })
          }
        >
          <option value="all">Tümü</option>
          <option value="online">Çevrimiçi</option>
          <option value="offline">Çevrimdışı</option>
          <option value="never">Henüz görülmedi</option>
        </AdminSelect>
      </FilterBar>
      {!result ? (
        <SectionSkeleton label="Cihaz havuzu yükleniyor" />
      ) : result.page.length === 0 && !result.isDone ? (
        <p role="status" className="text-sm text-muted-foreground">
          Bu sayfada eşleşme yok. Tarama devam ediyor; sonraki sayfaya geçin.
        </p>
      ) : result.page.length === 0 && paging.page > 1 ? (
        <p role="status" className="text-sm text-muted-foreground">
          Bu sayfada kayıt yok. Önceki sayfaya dönebilir veya filtreleri
          değiştirebilirsiniz.
        </p>
      ) : result.page.length === 0 ? (
        <EmptyState
          title={
            filtered ? "Filtrelere uygun kayıt yok" : "Envanterde cihaz yok"
          }
          description={
            filtered
              ? "Aramayı veya filtreleri değiştirin."
              : "Panel UUID’si ile bir cihaz kaydedin."
          }
          action={{
            label: filtered ? "Filtreleri temizle" : "Cihaz kaydet",
            onClick: filtered ? () => setFilters({}) : create,
          }}
        />
      ) : (
        <>
          <div className="hidden min-w-0 overflow-x-auto rounded-md border min-[761px]:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%]">Ad / kimlik</TableHead>
                  <TableHead>Marka</TableHead>
                  <TableHead className="w-16">Kapı</TableHead>
                  <TableHead className="w-[24%]">
                    Bağlantı / son görülme
                  </TableHead>
                  <TableHead>Proje</TableHead>
                  <TableHead className="w-14">
                    <span className="sr-only">İşlemler</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.page.map((device) => (
                  <TableRow
                    key={device._id}
                    className={ROW_CLICK_CLASS}
                    onClick={onRowActivate(() => setDialog({ device }))}
                  >
                    <TableCell>
                      <button
                        className="break-words text-left font-medium"
                        onClick={() => setDialog({ device })}
                      >
                        {device.name}
                      </button>
                      <p className="break-all text-xs text-muted-foreground">
                        {identity(device)}
                      </p>
                    </TableCell>
                    <TableCell>{brandLabel(device.brand)}</TableCell>
                    <TableCell className="tabular-nums">
                      {device.ideDoorCount ?? "—"}
                    </TableCell>
                    <TableCell>
                      {status(device)}
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                        {adminDate(device.lastSeen)}
                      </p>
                    </TableCell>
                    <TableCell className="break-words">
                      {assignment(device)}
                    </TableCell>
                    <TableCell className="px-1">{actions(device)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul
            aria-label="Cihaz havuzu"
            className="divide-y rounded-md border min-[761px]:hidden"
          >
            {result.page.map((device) => (
              <li
                key={device._id}
                className={`flex min-w-0 gap-2 p-3 ${ROW_CLICK_CLASS}`}
                onClick={onRowActivate(() => setDialog({ device }))}
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <button
                    className="break-words text-left text-sm font-medium"
                    onClick={() => setDialog({ device })}
                  >
                    {device.name}
                  </button>
                  <p className="break-all text-xs text-muted-foreground">
                    {brandLabel(device.brand)} · {identity(device)}
                  </p>
                  {status(device)}
                  <p className="break-words text-xs">{assignment(device)}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    Son görülme: {adminDate(device.lastSeen)}
                  </p>
                </div>
                {actions(device)}
              </li>
            ))}
          </ul>
        </>
      )}
      <AdminPagination
        page={paging.page}
        count={result?.page.length ?? 0}
        done={result?.isDone ?? false}
        loading={!raw}
        onPrevious={paging.previous}
        onNext={() => {
          if (result && !result.isDone) paging.next(result.continueCursor);
        }}
        size={paging.size}
        sizes={[10, 25, 50]}
        onSizeChange={paging.setSize}
      />
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button
          variant="outline"
          disabled={syncing}
          onClick={() => void sync()}
        >
          {syncing ? "İşlem sürüyor…" : "Envanteri senkronize et"}
        </Button>
        <Button
          variant="outline"
          aria-expanded={provisioning}
          onClick={() => setProvisioning((value) => !value)}
        >
          IDE kurulumu
        </Button>
      </div>
      {provisioning && (
        <AdminDataBoundary label="IDE kurulumu">
          <div className="min-w-0 [&_table]:table-fixed [&_td]:break-all [&_input]:min-w-0">
            <IdeProvisioningCard />
          </div>
        </AdminDataBoundary>
      )}
      <ConfirmDestructive
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Cihaz envanterden kaldırılsın mı?"
        objectName={
          deleteDevice
            ? `${deleteDevice.name} · ${identity(deleteDevice)}`
            : "Cihaz"
        }
        effects={[
          ...(deleteDevice?.assignedDeviceId
            ? [
                `Cihaz ${deleteDevice.assignedProjectName ?? "atanmış olduğu proje"} kapsamından çıkarılır.`,
                "Kapılar, okuyucular, grup cihaz bağlantıları ve bekleyen köprü işleri kaldırılır; bölge ve kart okuma geçmişi korunur.",
              ]
            : []),
          "Cihaz envanter kaydı kaldırılır. Bu işlem geri alınamaz.",
          ...(deleteError ? [deleteError] : []),
        ]}
        confirmLabel="Envanterden kaldır"
        onConfirm={async () => {
          if (!deleteDevice) throw new Error("Cihaz seçilmedi.");
          setDeleting(true);
          try {
            await remove({ adminDeviceId: deleteDevice._id });
            notify.success("Cihaz envanterden kaldırıldı");
            focusAdminHeading("admin-devices-heading");
          } catch (error) {
            setDeleteError(errorMessage(error));
            throw error;
          } finally {
            setDeleting(false);
          }
        }}
      />
      {dialog && (
        <AdminDeviceDialog
          open
          device={dialog.device}
          onClose={() => setDialog(null)}
          onSuccess={() => setDialog(null)}
        />
      )}
    </div>
  );
}
export function AdminDevicesPanel() {
  return (
    <AdminDataBoundary label="Cihaz havuzu">
      <AdminDevicesContent />
    </AdminDataBoundary>
  );
}
