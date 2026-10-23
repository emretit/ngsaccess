import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { CircleCheck, CircleX, LoaderCircle, RefreshCw, ScanLine } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { VIRTUAL_READER_HEARTBEAT_MS } from "../../convex/lib/virtualReader";
import { StatusScreen } from "@/components/public/StatusScreen";
import Logo from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePublicTheme } from "@/hooks/usePublicTheme";
import {
  createScanGate, READER_CAMERA_STORAGE_KEY, READER_TOKEN_STORAGE_KEY, readerTokenFromHash,
  RESULT_VISIBLE_MS, SCAN_TIMEOUT_MS, scanPresentation, type ReaderInfo, type ScanPresentation,
} from "@/components/virtual-reader/readerKiosk";
import { useQrCamera, useScreenWakeLock, type CameraFacing } from "@/components/virtual-reader/useQrCamera";

const CONNECT_RETRY_MS = 10_000;
const TIME_ZONE = "Europe/Istanbul";
const timeFormat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "full", timeZone: TIME_ZONE });

function initialToken(): string | null {
  const fromHash = readerTokenFromHash(window.location.hash);
  if (fromHash) {
    localStorage.setItem(READER_TOKEN_STORAGE_KEY, fromHash);
    // Anahtar adres çubuğunda/geçmişte kalmasın.
    window.history.replaceState(null, "", window.location.pathname);
    return fromHash;
  }
  return localStorage.getItem(READER_TOKEN_STORAGE_KEY);
}

export default function VirtualReaderKiosk() {
  usePageTitle("Sanal okuyucu");
  usePublicTheme();
  const [token, setToken] = useState<string | null>(initialToken);
  const [reader, setReader] = useState<ReaderInfo | null | undefined>(undefined);
  const connect = useMutation(api.virtualReaders.connect);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let connected = false;
    let retry: number | undefined;
    const beat = async () => {
      try {
        const info = await connect({ readerToken: token });
        connected = true;
        if (!cancelled) setReader(info);
      } catch {
        // Ağ kesintisinde son bilinen okuyucu bilgisiyle devam edilir; ilk bağlantı kısa aralıkla yeniden denenir.
        if (!connected && !cancelled) retry = window.setTimeout(() => void beat(), CONNECT_RETRY_MS);
      }
    };
    void beat();
    const timer = window.setInterval(() => void beat(), VIRTUAL_READER_HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(retry);
    };
  }, [connect, token]);

  const forget = () => {
    localStorage.removeItem(READER_TOKEN_STORAGE_KEY);
    setToken(null);
    setReader(undefined);
  };

  if (!token) {
    return (
      <StatusScreen
        tone="info"
        title="Bu ekran bir okuyucuya bağlı değil."
        description="Yönetici panelinde Cihazlar → Cihaz ekle → Sanal okuyucu adımındaki bağlantıyı bu cihazda açın."
      />
    );
  }
  if (reader === undefined) {
    return <StatusScreen tone="loading" title="Okuyucu bağlanıyor…" description="Bağlantı kurulamazsa birkaç saniyede bir yeniden denenir." />;
  }
  if (reader === null) {
    return (
      <StatusScreen
        tone="error"
        title="Okuyucu bağlantısı geçersiz."
        description="Okuyucu silinmiş ya da bağlantısı yenilenmiş olabilir. Yöneticiden güncel bağlantıyı isteyin."
        primaryAction={{ label: "Bağlantıyı unut", onClick: forget }}
      />
    );
  }
  return <ReaderScreen token={token} reader={reader} onReaderInvalid={() => setReader(null)} />;
}

type Phase = { kind: "idle" } | { kind: "checking" } | { kind: "result"; presentation: ScanPresentation };

function ReaderScreen({ token, reader, onReaderInvalid }: { token: string; reader: ReaderInfo; onReaderInvalid: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const gate = useRef(createScanGate());
  const scan = useMutation(api.virtualReaders.scan);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [facing, setFacing] = useState<CameraFacing>(
    () => localStorage.getItem(READER_CAMERA_STORAGE_KEY) === "environment" ? "environment" : "user",
  );
  const now = useNow(15_000);
  useScreenWakeLock(true);

  const onCode = useCallback((code: string) => {
    if (!gate.current.tryAcquire(code, Date.now())) return;
    setPhase({ kind: "checking" });
    void (async () => {
      let presentation: ScanPresentation;
      let timer: number | undefined;
      try {
        const result = await Promise.race([
          scan({ readerToken: token, code }),
          new Promise<"timeout">(resolve => { timer = window.setTimeout(() => resolve("timeout"), SCAN_TIMEOUT_MS); }),
        ]);
        if (result === "timeout") {
          presentation = { tone: "error", title: "Sunucu yanıt vermedi", detail: "İnternet bağlantısını kontrol edip tekrar okutun." };
        } else {
          if (result.status === "reader_invalid") onReaderInvalid();
          presentation = scanPresentation(result);
        }
      } catch {
        presentation = { tone: "error", title: "Okutma tamamlanamadı", detail: "Birkaç saniye sonra tekrar okutun." };
      } finally {
        window.clearTimeout(timer);
      }
      setPhase({ kind: "result", presentation });
      window.setTimeout(() => {
        gate.current.release(Date.now());
        setPhase({ kind: "idle" });
      }, RESULT_VISIBLE_MS);
    })();
  }, [onReaderInvalid, scan, token]);

  const camera = useQrCamera(videoRef, facing, onCode);
  const switchCamera = () => {
    const next = facing === "user" ? "environment" : "user";
    localStorage.setItem(READER_CAMERA_STORAGE_KEY, next);
    setFacing(next);
  };
  const time = timeFormat.format(now);
  const date = dateFormat.format(now);

  return (
    <main className="flex min-h-dvh flex-col bg-canvas text-text [color-scheme:light] lg:h-dvh lg:flex-row">
      <section aria-label="Kamera" className="relative flex min-h-[55dvh] flex-1 items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`}
        />
        {camera === "running" && phase.kind === "idle" && (
          <div aria-hidden="true" className="relative h-[min(60vw,60dvh,420px)] w-[min(60vw,60dvh,420px)] rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        )}
        {(camera === "denied" || camera === "unavailable") && (
          <div className="relative max-w-sm space-y-2 px-6 text-center text-white">
            <CircleX aria-hidden="true" className="mx-auto h-10 w-10" />
            <p className="text-lg font-semibold">{camera === "denied" ? "Kamera izni verilmedi" : "Kamera açılamadı"}</p>
            <p className="text-sm text-white/80">
              {camera === "denied"
                ? "Tarayıcı ayarlarından bu site için kamera iznini açıp sayfayı yenileyin."
                : "Cihazda kamera bulunamadı ya da başka bir uygulama kullanıyor."}
            </p>
          </div>
        )}
        {camera === "starting" && <LoaderCircle aria-label="Kamera açılıyor" className="relative h-10 w-10 animate-spin text-white" />}
        {phase.kind !== "idle" && <ScanOverlay phase={phase} />}
      </section>

      <aside className="flex w-full flex-col gap-6 border-t border-line bg-surface p-6 lg:w-[380px] lg:border-l lg:border-t-0 lg:p-8">
        <Logo tone="dark" size="md" className="[&_img]:h-[30px] [&_img]:w-[30px] [&_span]:text-[19px]" />
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{reader.projectName ?? "Sanal okuyucu"}</p>
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-.02em]">{reader.name}</h1>
        </div>
        <div>
          <p className="text-5xl font-semibold tabular-nums tracking-[-.03em]">{time}</p>
          <p className="mt-1 text-sm text-muted-foreground">{date}</p>
        </div>
        {!reader.isActive && (
          <p role="alert" className="rounded-md border border-line bg-warning-bg p-3 text-sm">
            Okuyucu pasif. Yönetici Cihazlar sayfasından etkinleştirene kadar okutma kaydedilmez.
          </p>
        )}
        <div className="flex gap-3 text-sm text-muted-foreground">
          <ScanLine aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Mobil uygulamada <strong className="text-text">QR</strong> sekmesini açın ve kodu kameraya gösterin.</p>
        </div>
        <div className="mt-auto">
          <Button type="button" variant="outline" className="min-h-11 w-full" onClick={switchCamera}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {facing === "user" ? "Arka kameraya geç" : "Ön kameraya geç"}
          </Button>
        </div>
      </aside>
    </main>
  );
}

function ScanOverlay({ phase }: { phase: Exclude<Phase, { kind: "idle" }> }) {
  if (phase.kind === "checking") {
    return (
      <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
        <LoaderCircle aria-hidden="true" className="h-14 w-14 animate-spin" />
        <p className="text-xl font-semibold">Kontrol ediliyor…</p>
      </div>
    );
  }
  const success = phase.presentation.tone === "success";
  const Icon = success ? CircleCheck : CircleX;
  return (
    <div
      role={success ? "status" : "alert"}
      className={`absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center ${success ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}
    >
      <Icon aria-hidden="true" className="h-24 w-24" />
      <p className="text-4xl font-semibold tracking-[-.02em] text-text">{phase.presentation.title}</p>
      <p className="text-xl text-text">{phase.presentation.detail}</p>
    </div>
  );
}
