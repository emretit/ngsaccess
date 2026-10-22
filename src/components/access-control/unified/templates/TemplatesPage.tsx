import { notify } from "@/lib/notify";
import { visibleTemplates } from "./model";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../../../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { TemplateEditor, type Template } from "./TemplateEditor";
import { formatSchedule } from "./schedule";
export default function TemplatesPage() {
  const { projectId, isAdmin } = useActiveProject();
  const [params, setParams] = useSearchParams();
  const [archived, setArchived] = useState(false);
  const rows = useQuery(
    api.accessScheduleTemplates.list,
    projectId ? { projectId, includeArchived: true } : "skip",
  );
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<{
    kind: "copy" | "delete";
    template: Template;
  } | null>(null);
  const [copyName, setCopyName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const duplicate = useMutation(api.accessScheduleTemplates.duplicate);
  const remove = useMutation(api.accessScheduleTemplates.remove);
  const archive = useMutation(api.accessScheduleTemplates.setArchived);
  const selected = rows?.find((t) => t._id === params.get("template"));
  const select = (id?: string) => {
    setError("");
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("template", id);
        else next.delete("template");
        return next;
      },
      { replace: true },
    );
  };
  const run = async (fn: () => Promise<unknown>, success: string) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await fn();
      setAction(null);
      setError("");
      notify.success(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Zaman Şablonları</h1>
        {isAdmin && projectId && (
          <Button onClick={() => { setError(""); setCreating(true); }}>Yeni şablon</Button>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={archived} onCheckedChange={setArchived} />
        Arşivlenenleri göster
      </label>
      {error && !action && (
        <p role="alert" className="text-danger break-words">
          {error}
        </p>
      )}
      {!projectId ? (
        <p>Önce bir proje seçin.</p>
      ) : !rows ? (
        <SectionSkeleton label="Zaman şablonları yükleniyor" />
      ) : (
        <div className="space-y-3">
          {visibleTemplates(rows, archived).length === 0 && (
            <p>Henüz zaman şablonu yok.</p>
          )}
          {visibleTemplates(rows, archived).map((t) => (
            <article
              key={t._id}
              className="rounded-md border p-4 space-y-2 min-w-0"
            >
              <div className="flex flex-wrap gap-2 items-center">
                <h2 className="font-medium break-all">{t.name}</h2>
                {t.isArchived && <Badge variant="secondary">Arşivli</Badge>}
              </div>
              <p className="text-sm break-words">{formatSchedule(t.week)}</p>
              <p className="text-xs text-muted-foreground">
                {t.ruleCount} bağlı kural
              </p>
              {t.description && (
                <p className="text-sm break-words">{t.description}</p>
              )}
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => select(t._id)}>
                    Düzenle
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setError("");
                      setCopyName(`${t.name} kopyası`);
                      setAction({ kind: "copy", template: t });
                    }}
                  >
                    Kopyala
                  </Button>
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      void run(() =>
                        archive({
                          templateId: t._id,
                          isArchived: !t.isArchived,
                        }),
                        t.isArchived ? "Şablon arşivden çıkarıldı" : "Şablon arşivlendi",
                      )
                    }
                  >
                    {t.isArchived ? "Geri al" : "Arşivle"}
                  </Button>
                  <span
                    title={
                      t.ruleCount
                        ? `${t.ruleCount} kural kullanıyor`
                        : undefined
                    }
                  >
                    <Button
                      variant="outline"
                      disabled={t.ruleCount > 0 || pending}
                      onClick={() => {
                        setError("");
                        setAction({ kind: "delete", template: t });
                      }}
                    >
                      Sil
                    </Button>
                  </span>
                  {t.ruleCount > 0 && (
                    <span className="text-xs self-center">
                      {t.ruleCount} kural kullanıyor
                    </span>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {isAdmin && projectId && (creating || selected) && (
        <TemplateEditor
          key={selected?._id ?? "new"}
          projectId={projectId}
          template={selected ?? null}
          onClose={() => {
            setCreating(false);
            select();
          }}
        />
      )}
      <Dialog
        open={isAdmin && !!projectId && !!rows && !!params.get("template") && !selected && !creating}
        onOpenChange={(open) => { if (!open) select(); }}
      >
        <DialogContent className="w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Bu şablon silindi</DialogTitle>
            <DialogDescription>Şablon artık kullanılamadığı için düzenleyici kapatıldı.</DialogDescription>
          </DialogHeader>
          <Button onClick={() => select()}>Kapat</Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !pending) { setAction(null); setError(""); }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>
              {action?.kind === "copy"
                ? "Şablonu kopyala"
                : "Şablon silinsin mi?"}
            </DialogTitle>
            <DialogDescription>{action?.template.name}</DialogDescription>
          </DialogHeader>
          {action?.kind === "copy" ? (
            <Input
              aria-label="Kopya şablon adı"
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
            />
          ) : (
            <p>Bu şablon kalıcı olarak silinecek.</p>
          )}
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <Button
            disabled={pending || (action?.kind === "copy" && !copyName.trim())}
            onClick={() => {
              if (!action) return;
              void run(() =>
                action.kind === "copy"
                  ? duplicate({
                      templateId: action.template._id,
                      name: copyName,
                    })
                  : remove({ templateId: action.template._id }),
                action.kind === "copy" ? "Şablon kopyalandı" : "Şablon silindi",
              );
            }}
          >
            {action?.kind === "copy" ? "Kopyala" : "Şablonu sil"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
