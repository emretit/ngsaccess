import { useEffect, useRef, useState, type RefObject } from "react";
import jsQR from "jsqr";

export type CameraFacing = "user" | "environment";
export type CameraState = "starting" | "running" | "denied" | "unavailable";

const SCAN_INTERVAL_MS = 180;
const MAX_DECODE_WIDTH = 640;

/** Kamerayı açar, kareleri jsQR ile çözer; kod bulununca onCode çağrılır. */
export function useQrCamera(
  videoRef: RefObject<HTMLVideoElement | null>,
  facing: CameraFacing,
  onCode: (code: string) => void,
): CameraState {
  const [state, setState] = useState<CameraState>("starting");
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let attached: HTMLVideoElement | null = null;
    let timer: number | undefined;
    let cancelled = false;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    setState("starting");

    const tick = () => {
      const video = videoRef.current;
      if (cancelled) return;
      if (video && context && video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
        if (code?.data) onCodeRef.current(code.data);
      }
      timer = window.setTimeout(tick, SCAN_INTERVAL_MS);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        return;
      }
      try {
        const opened = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        // Kamera değişimi/çıkış izin beklerken olduysa temizlik zaten koştu: akışı burada kapat.
        if (cancelled) {
          opened.getTracks().forEach(track => track.stop());
          return;
        }
        stream = opened;
        const video = videoRef.current;
        if (!video) return;
        attached = video;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setState("running");
        tick();
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    };
    void start();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
      if (attached) attached.srcObject = null;
    };
  }, [facing, videoRef]);

  return state;
}

/** Tablet uykuya geçip okuyucu kapanmasın; sekme yeniden görünür olunca kilit yenilenir. */
export function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let released = false;
    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        // İstek beklerken ekran kapandıysa kilit hemen bırakılır, sızmaz.
        if (released) void lock.release().catch(() => undefined);
        else sentinel = lock;
      } catch {
        // Pil tasarrufu vb. reddedebilir; okuyucu yine çalışır.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
