import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAdminPrimaryAction } from "./hooks/useAdminPrimaryAction";
import { useState } from "react";
import { z } from "zod";
import { ConvexError } from "convex/values";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatInline } from "@/components/shared/StatInline";
import { FilterBar } from "@/components/shared/FilterBar";
import {
  AdminEmptyState as EmptyState,
  focusAdminHeading,
} from "./components/AdminListParts";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { RowActions } from "@/components/shared/RowActions";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { errorMessage, notify } from "@/lib/notify";
import { AdminDataBoundary } from "./components/AdminDataBoundary";
import {
  AdminSelect,
  AdminPagination,
  adminDate,
  useAdminPagination,
} from "./components/AdminListParts";
import { useAdminFormGuard } from "./hooks/useAdminFormGuard";

type Project = FunctionReturnType<
  typeof api.projects.adminList
>["page"][number];
const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Proje adını girin.")
    .max(100, "Proje adı en fazla 100 karakter olabilir."),
  description: z.string(),
  isActive: z.boolean(),
});
type ProjectForm = z.infer<typeof projectSchema>;
function ProjectEditor({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  const [baseline] = useState<ProjectForm>(() => ({
    name: project?.name ?? "",
    description: project?.description ?? "",
    isActive: project?.isActive ?? true,
  }));
  const [form, setForm] = useState(baseline);
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string>();
  const create = useMutation(api.projects.create);
  const update = useMutation(api.projects.update);
  const { run, pending } = useAsyncAction(async () => {
    setError(undefined);
    setNameError(undefined);
    const parsed = projectSchema.safeParse(form);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message);
      return false;
    }
    try {
      if (project) await update({ id: project._id, ...parsed.data });
      else await create(parsed.data);
      notify.success(project ? "Proje güncellendi" : "Proje oluşturuldu");
      onClose();
    } catch (cause) {
      if (
        cause instanceof ConvexError &&
        typeof cause.data === "object" &&
        cause.data !== null &&
        "code" in cause.data &&
        (cause.data.code === "PROJECT_NAME_REQUIRED" ||
          cause.data.code === "PROJECT_NAME_TOO_LONG")
      )
        setNameError(errorMessage(cause));
      else setError(errorMessage(cause));
      throw cause;
    }
  });
  const guard = useAdminFormGuard(
    "admin-project",
    JSON.stringify(form) !== JSON.stringify(baseline),
    pending,
  );
  const close = () => {
    if (!pending) guard.requestClose(onClose);
  };
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          aria-busy={pending}
        >
          <DialogHeader>
            <DialogTitle>
              {project ? "Projeyi düzenle" : "Yeni proje"}
            </DialogTitle>
            <DialogDescription>
              Proje bilgilerini ve seçicideki görünürlüğünü yönetin.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run();
            }}
          >
            <FormFieldWrapper
              htmlFor="admin-project-name"
              label="Ad (zorunlu)"
              error={nameError}
            >
              <Input
                value={form.name}
                disabled={pending}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </FormFieldWrapper>
            <FormFieldWrapper
              htmlFor="admin-project-description"
              label="Açıklama (opsiyonel)"
            >
              <Textarea
                value={form.description}
                disabled={pending}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </FormFieldWrapper>
            <FormFieldWrapper
              htmlFor="admin-project-status"
              label="Durum"
              hint="Pasif proje, aktif proje seçicisinde listelenmez. Veriler ve mevcut erişimler korunur."
            >
              <select
                disabled={pending}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={form.isActive ? "active" : "inactive"}
                onChange={(event) =>
                  setForm({
                    ...form,
                    isActive: event.target.value === "active",
                  })
                }
              >
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </FormFieldWrapper>
            {error && (
              <p role="alert" className="break-words text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={close}
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "İşlem sürüyor…" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard.dialog}
    </>
  );
}

function ProjectDeletion({
  project,
  onClose,
  onEdit,
}: {
  project: Project;
  onClose: () => void;
  onEdit: () => void;
}) {
  const impact = useQuery(api.projects.getDeletionImpact, {
    projectId: project._id,
  });
  const remove = useMutation(api.projects.remove);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  useAdminFormGuard("admin-project-delete", false, pending);
  const counts = (items: NonNullable<typeof impact>["cleanup"]) =>
    items.map(
      (item) => `${item.label}: ${item.count}${item.capped ? "+" : ""}`,
    );
  return (
    <>
      <Dialog
        open={!confirm}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proje silme etkileri</DialogTitle>
            <DialogDescription className="break-words">
              {project.name}
            </DialogDescription>
          </DialogHeader>
          {!impact ? (
            <SectionSkeleton label="Silme etkileri yükleniyor" />
          ) : (
            <div className="space-y-3 text-sm">
              {!impact.canDelete && (
                <>
                  <p role="alert">
                    Bu projeye bağlı iş verileri var; önce bunları taşıyın veya
                    silin. Geçmiş kayıtlarını korumak için projeyi pasife
                    alabilirsiniz.
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    {counts(impact.blockers).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="font-medium">
                {impact.canDelete
                  ? "Silinecek bağlı kayıtlar"
                  : "Engeller kaldırıldığında silinecek bağlı kayıtlar"}
              </p>
              {impact.cleanup.length ? (
                <ul className="list-disc space-y-1 pl-5">
                  {counts(impact.cleanup).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p>Silinecek bağlı kayıt bulunmadı.</p>
              )}
              <p>Denetim geçmişi korunur. Silme işlemi geri alınamaz.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button variant="outline" onClick={onEdit}>
              Proje durumunu düzenle
            </Button>
            <Button
              variant="destructive"
              disabled={!impact?.canDelete}
              onClick={() => setConfirm(true)}
            >
              Silmeyi onayla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDestructive
        open={confirm}
        onOpenChange={(open) => {
          setConfirm(open);
        }}
        title="Proje silinsin mi?"
        objectName={project.name}
        effects={[
          "İş verisi varsa proje silinemez.",
          ...(impact ? counts(impact.cleanup) : []),
          "Ayarlar, kullanıcı üyelikleri, davetler ve sohbetler silinir; denetim geçmişi korunur.",
          "Bu işlem geri alınamaz.",
          ...(error
            ? [
                error,
                "Vazgeç ile etki dökümüne dönüp proje durumunu düzenleyebilirsiniz.",
              ]
            : []),
        ]}
        confirmLabel="Projeyi sil"
        onConfirm={async () => {
          if (!impact?.canDelete)
            throw new Error("Projeye bağlı iş verileri var.");
          setPending(true);
          setError(undefined);
          try {
            await remove({ id: project._id });
            notify.success("Proje silindi");
            focusAdminHeading("admin-projects-heading");
            onClose();
          } catch (cause) {
            setError(errorMessage(cause));
            throw cause;
          } finally {
            setPending(false);
          }
        }}
      />
    </>
  );
}

function AdminProjectsContent() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | undefined>();
  const debouncedSearch = useDebouncedValue(search, 300);
  const paging = useAdminPagination(JSON.stringify({ search: debouncedSearch, status }));
  const result = useQuery(api.projects.adminList, {
    search: debouncedSearch,
    status,
    paginationOpts: { numItems: paging.size, cursor: paging.cursor },
  });
  const [editing, setEditing] = useState<{ project: Project | null } | null>(
    null,
  );
  const primaryInHeader = useAdminPrimaryAction("Yeni proje", () =>
    setEditing({ project: null }),
  );
  const [deleting, setDeleting] = useState<Project | null>(null);
  const clear = () => {
    setSearch("");
    setStatus(undefined);
  };
  const actions = (project: Project) => (
    <RowActions label={`${project.name} proje işlemleri`}>
      <DropdownMenuItem onSelect={() => setEditing({ project })}>
        Düzenle
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-destructive"
        onSelect={() => setDeleting(project)}
      >
        Projeyi sil
      </DropdownMenuItem>
    </RowActions>
  );
  const badge = (project: Project) => (
    <StatusBadge tone={project.isActive ? "success" : "neutral"}>
      {project.isActive ? "Aktif" : "Pasif"}
    </StatusBadge>
  );
  const members = (project: Project) =>
    `${project.memberCount}${project.memberCountCapped ? "+" : ""}`;
  const filtered = Boolean(search || status);
  return (
    <div className="min-w-0 space-y-5">
      <h2 id="admin-projects-heading" tabIndex={-1} className="sr-only">
        Projeler
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatInline
          loading={!result}
          items={[
            { label: "Bu sayfada", value: result?.page.length },
            {
              label: "Aktif (bu sayfa)",
              value: result?.page.filter((project) => project.isActive).length,
            },
            {
              label: "Pasif (bu sayfa)",
              value: result?.page.filter((project) => !project.isActive).length,
            },
          ]}
        />
        {!primaryInHeader && (
          <Button onClick={() => setEditing({ project: null })}>
            Yeni proje
          </Button>
        )}
      </div>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Ad veya açıklama ara"
        searchLabel="Proje ara"
        hasFilters={filtered}
        onClear={clear}
      >
        <AdminSelect
          label="Durum"
          value={status ?? "all"}
          onChange={(value) =>
            setStatus(
              value === "active" || value === "inactive" ? value : undefined,
            )
          }
        >
          <option value="all">Tümü</option>
          <option value="active">Aktif</option>
          <option value="inactive">Pasif</option>
        </AdminSelect>
      </FilterBar>
      {!result ? (
        <SectionSkeleton label="Projeler yükleniyor" />
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
          title={filtered ? "Filtrelere uygun kayıt yok" : "Henüz proje yok"}
          description={
            filtered
              ? "Aramayı veya filtreleri değiştirin."
              : "Kullanıcı ve cihaz atamak için önce bir proje oluşturun."
          }
          action={{
            label: filtered ? "Filtreleri temizle" : "Yeni proje",
            onClick: filtered ? clear : () => setEditing({ project: null }),
          }}
        />
      ) : (
        <>
          <div className="hidden min-w-0 overflow-x-auto rounded-md border min-[761px]:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[32%]">Ad</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Üyeler</TableHead>
                  <TableHead className="w-[20%]">Oluşturulma</TableHead>
                  <TableHead className="w-14">
                    <span className="sr-only">İşlemler</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.page.map((project) => (
                  <TableRow key={project._id}>
                    <TableCell>
                      <button
                        className="text-left font-medium underline-offset-4 hover:underline break-words"
                        onClick={() => setEditing({ project })}
                      >
                        {project.name}
                      </button>
                    </TableCell>
                    <TableCell>{badge(project)}</TableCell>
                    <TableCell className="tabular-nums">
                      {members(project)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {adminDate(project.createdAt)}
                    </TableCell>
                    <TableCell className="px-1">{actions(project)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul
            aria-label="Projeler"
            className="divide-y rounded-md border min-[761px]:hidden"
          >
            {result.page.map((project) => (
              <li key={project._id} className="flex min-w-0 gap-2 p-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <button
                    className="break-words text-left text-sm font-medium"
                    onClick={() => setEditing({ project })}
                  >
                    {project.name}
                  </button>
                  <div>{badge(project)}</div>
                  <p className="text-xs text-muted-foreground">
                    {members(project)} üye
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {adminDate(project.createdAt)}
                  </p>
                </div>
                {actions(project)}
              </li>
            ))}
          </ul>
        </>
      )}
      <AdminPagination
        page={paging.page}
        count={result?.page.length ?? 0}
        done={result?.isDone ?? false}
        loading={!result}
        onPrevious={paging.previous}
        onNext={() => {
          if (result && !result.isDone) paging.next(result.continueCursor);
        }}
        size={paging.size}
        sizes={[10, 25]}
        onSizeChange={paging.setSize}
      />
      {editing && (
        <ProjectEditor
          project={editing.project}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <AdminDataBoundary label="Silme etkileri">
          <ProjectDeletion
            project={deleting}
            onClose={() => setDeleting(null)}
            onEdit={() => {
              setEditing({ project: deleting });
              setDeleting(null);
            }}
          />
        </AdminDataBoundary>
      )}
    </div>
  );
}
export default function AdminProjectsPanel() {
  return (
    <AdminDataBoundary label="Projeler">
      <AdminProjectsContent />
    </AdminDataBoundary>
  );
}
