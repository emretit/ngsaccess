import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { virtualReaderPath } from "../../../convex/lib/virtualReader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/lib/notify";

export function virtualReaderUrl(readerToken: string, origin = window.location.origin): string {
  return `${origin}${virtualReaderPath(readerToken)}`;
}

/** Var olan okuyucunun bağlantısı (satır menüsü) ya da yeni okuyucu oluşturma. */
export type VirtualReaderDialogState =
  | { mode: "create" }
  | { mode: "link"; name: string; readerToken: string };

interface VirtualReaderDialogProps {
  state: VirtualReaderDialogState | null;
  projectId: Id<"projects"> | undefined;
  onClose: () => void;
}

export function VirtualReaderDialog({ state, projectId, onClose }: VirtualReaderDialogProps) {
  const [created, setCreated] = useState<{ name: string; readerToken: string } | null>(null);
  const view = created ?? (state?.mode === "link" ? state : null);
  const close = () => {
    setCreated(null);
    onClose();
  };

  return (
    <Dialog open={state !== null} onOpenChange={open => !open && close()}>
      <DialogContent className="sm:max-w-md">
        {view ? (
          <ReaderLink name={view.name} readerToken={view.readerToken} onDone={close} />
        ) : (
          <CreateReaderForm projectId={projectId} onCreated={setCreated} onCancel={close} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateReaderForm({ projectId, onCreated, onCancel }: {
  projectId: Id<"projects"> | undefined;
  onCreated: (reader: { name: string; readerToken: string }) => void;
  onCancel: () => void;
}) {
  const createReader = useMutation(api.virtualReaders.create);
  const [name, setName] = useState("");
  const [attempted, setAttempted] = useState(false);
  const { run, pending } = useAsyncAction(async (readerName: string) => {
    if (!projectId) throw new Error("Önce bir proje seçin");
    const { readerToken } = await createReader({ projectId, name: readerName });
    onCreated({ name: readerName, readerToken });
  }, { error: "Sanal okuyucu eklenemedi" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    const trimmed = name.trim();
    if (trimmed) void run(trimmed);
  };
  const nameMissing = attempted && !name.trim();

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>Sanal okuyucu ekle</DialogTitle>
        <DialogDescription>
          Girişe koyacağınız tablet veya telefon, kamerasıyla çalışanın mobil uygulamadaki QR kodunu okur.
          Kapı açmaz; okutmalar PDKS'ye düşer, giriş-çıkış yönünü PDKS ayarları belirler.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="virtual-reader-name">Okuyucu adı</Label>
        <Input
          id="virtual-reader-name"
          autoFocus
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Örn. Ana giriş tableti"
          aria-invalid={nameMissing}
          aria-describedby={nameMissing ? "virtual-reader-name-error" : undefined}
        />
        {nameMissing && <p id="virtual-reader-name-error" className="text-sm text-destructive">Okuyucu adı zorunlu</p>}
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onCancel}>İptal</Button>
        <Button type="submit" disabled={pending || !projectId}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Ekle
        </Button>
      </DialogFooter>
    </form>
  );
}

function ReaderLink({ name, readerToken, onDone }: { name: string; readerToken: string; onDone: () => void }) {
  const url = virtualReaderUrl(readerToken);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify.success("Bağlantı kopyalandı");
    } catch (error) {
      notify.error("Bağlantı kopyalanamadı", error);
    }
  };

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle>{name} — okuyucu ekranı</DialogTitle>
        <DialogDescription>
          Tablet veya telefonun kamerasıyla bu kodu okutun ya da bağlantıyı o cihazda açın. Ekran açık kaldıkça okuyucu çevrimiçi görünür.
        </DialogDescription>
      </DialogHeader>
      <div className="flex justify-center">
        <div className="rounded-md border border-line bg-white p-3">
          <QRCodeSVG value={url} size={200} level="M" role="img" aria-label={`${name} okuyucu ekranı bağlantısı`} />
        </div>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Bağlantıyı girişteki tablette açın, kamera izni verin.</li>
        <li>Çalışan mobil uygulamada QR sekmesini açıp kodunu kameraya gösterir.</li>
        <li>Okutma, Canlı İzleme ve PDKS kayıtlarına düşer.</li>
      </ol>
      <p className="text-xs text-muted-foreground">
        Bu bağlantı okuyucunun anahtarıdır; yalnız okuyucu cihazla paylaşın.
      </p>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={() => void copy()}>
          <Copy className="mr-2 h-4 w-4" />
          Kopyala
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Bu cihazda aç
          </a>
        </Button>
        <Button type="button" onClick={onDone}>Tamam</Button>
      </DialogFooter>
    </div>
  );
}
