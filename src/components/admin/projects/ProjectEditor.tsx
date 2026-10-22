import { useState } from "react";
import { ConvexError } from "convex/values";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { errorMessage, notify } from "@/lib/notify";
import { useAdminFormGuard } from "../hooks/useAdminFormGuard";
import { projectSchema, type Project, type ProjectForm } from "./projectSchema";
export function ProjectEditor({
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
