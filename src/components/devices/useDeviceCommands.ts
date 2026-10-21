import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/lib/notify";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ServerDevice } from "@/types/device";
import type { ConfirmedAction, OperationResult } from "./deviceAdapter";
import { deviceLabels } from "./deviceLabels";
export function useDeviceCommands(
  device: ServerDevice,
  onPendingChange?: (pending: boolean) => void,
) {
  const fetchCapabilities = useAction(
    api.actions.hikGatewayDevice.fetchDeviceCapabilities,
  );
  const fetchWorkStatus = useAction(
    api.actions.hikGatewayDevice.fetchDeviceWorkStatus,
  );
  const reconcile = useAction(api.actions.hikGatewayDevice.reconcileDevice);
  const backfillEvents = useAction(
    api.actions.hikGatewayDevice.backfillDeviceEvents,
  );
  const captureCard = useAction(
    api.actions.hikGatewayDevice.captureCardFromDevice,
  );
  const fetchReaderCfg = useAction(api.actions.hikGatewayDevice.fetchReaderCfg);
  const openHikDoor = useAction(api.actions.hikGatewayDevice.remoteOpenDoor);
  const rebootHikDevice = useAction(api.actions.hikGatewayDevice.rebootDevice);
  const openIdeDoor = useAction(api.actions.ideGatewayDevice.openIdeDoor);
  const triggerIdeSync = useAction(
    api.actions.ideGatewayDevice.triggerPanelSync,
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ConfirmedAction | null>(
    null,
  );
  const [reconcileSummary, setReconcileSummary] = useState<string | null>(null);
  const [capturedCard, setCapturedCard] = useState<string | null>(null);

  const { run: execute, pending } = useAsyncAction(
    async (
      id: string,
      run: () => Promise<OperationResult>,
      onSuccess?: (result: OperationResult) => void,
    ) => {
      setBusy(id);
      try {
        const result = await run();
        if (!result.ok) throw new Error(result.error ?? "İşlem başarısız");
        notify.success(
          result.queued
            ? "Komut sıraya alındı; cihaz onayı bekleniyor."
            : deviceLabels.commandSent,
        );
        onSuccess?.(result);
      } finally {
        setBusy(null);
      }
    },
  );
  const [longRunning, setLongRunning] = useState(false);
  useEffect(() => {
    if (!pending) {
      setLongRunning(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setLongRunning(true);
      setPendingAction(null);
    }, 20_000);
    return () => window.clearTimeout(timer);
  }, [pending]);
  useEffect(() => {
    onPendingChange?.(pending && !longRunning);
  }, [pending, longRunning, onPendingChange]);
  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);
  const runConfirmed = async () => {
    if (!pendingAction) return;
    if (await execute(pendingAction.id, pendingAction.run))
      setPendingAction(null);
  };

  const handleFetchCapabilities = () =>
    execute("capabilities", async () => {
      const result = await fetchCapabilities({ deviceId: device._id });
      return result.ok
        ? { ok: true }
        : { ok: false, error: result.error ?? "Özellik taraması başarısız" };
    });

  const handleFetchWorkStatus = () =>
    execute("workStatus", async () => {
      const result = await fetchWorkStatus({ deviceId: device._id });
      return result.ok
        ? { ok: true }
        : { ok: false, error: result.error ?? "Çalışma durumu alınamadı" };
    });

  const handleReconcile = () =>
    execute("reconcile", async () => {
      const result = await reconcile({ deviceId: device._id });
      if (!result.ok) {
        return {
          ok: false,
          error: result.error ?? "Eşitlik kontrolü başarısız",
        };
      }
      setReconcileSummary(
        `Kart ${result.onDeviceCount}/${result.expectedCount}, yüz ${result.faceOnDeviceCount}/${result.faceExpectedCount}, parmak izi ${result.fingerprintOnDeviceCount}/${result.fingerprintExpectedCount}`,
      );
      return { ok: true };
    });

  const handleBackfill = () =>
    setPendingAction({
      id: "backfillEvents",
      title: deviceLabels.backfillEvents,
      description: "Cihazdan geçmiş olaylar alınacak; işlem zaman alabilir.",
      run: async () => {
        const result = await backfillEvents({ deviceId: device._id });
        return result.ok
          ? { ok: true }
          : { ok: false, error: result.error ?? "Geçmiş olaylar alınamadı" };
      },
    });

  const handleCaptureCard = () =>
    setPendingAction({
      id: "captureCard",
      title: deviceLabels.captureCard,
      description: "Okuyucu canlı kart yakalama moduna alınacak.",
      run: async () => {
        const result = await captureCard({ deviceId: device._id });
        if (!result.ok) {
          return { ok: false, error: result.error ?? "Kart okunamadı" };
        }
        setCapturedCard(result.cardNo ?? null);
        return { ok: true };
      },
    });

  const handleFetchReaderCfg = (readerId: Id<"readers">) =>
    execute("readerCfg", async () => {
      const result = await fetchReaderCfg({ readerId });
      return result.ok
        ? { ok: true }
        : { ok: false, error: result.error ?? "Okuyucu ayarları alınamadı" };
    });

  const handleOpenDoor = (
    doorId: Id<"doors">,
    doorNo: number | undefined,
    doorName: string,
  ) => {
    if (
      device.brand !== "ide_smart" &&
      (doorNo === undefined || !Number.isInteger(doorNo) || doorNo < 1)
    ) {
      notify.error(
        "Kapı numarası tanımlı veya geçerli değil. Kapı eşlemesini düzeltip tekrar deneyin.",
      );
      return;
    }
    setPendingAction({
      id: `openDoor:${doorId}`,
      title: "Kapı açılsın mı?",
      description: `${device.name ?? "Bu cihaz"} — ${doorName}${doorNo !== undefined ? ` (Kapı ${doorNo})` : ""} için kapı açma komutu gönderilecek.`,

      run: async () => {
        if (device.brand === "ide_smart") {
          const result = await openIdeDoor({
            deviceId: device._id,
            doorId,
            keep: 1,
          });
          return result.ok
            ? { ok: true, queued: true }
            : {
                ok: false,
                error: result.error ?? "Kapı açma kuyruğa alınamadı",
              };
        }
        if (doorNo === undefined || !Number.isInteger(doorNo) || doorNo < 1) {
          return {
            ok: false,
            error: "Kapı numarası geçerli değil. Kapı eşlemesini düzeltin.",
          };
        }
        const result = await openHikDoor({ deviceId: device._id, doorNo });
        return result.ok
          ? { ok: true, queued: device.hikTransport === "localBridge" }
          : { ok: false, error: result.error ?? "Kapı açılamadı" };
      },
    });
  };

  const handleReboot = () => {
    setPendingAction({
      id: "reboot",
      title: "Cihaz yeniden başlatılsın mı?",
      description: "Cihaz ~30-60 sn çevrimdışı olur.",
      destructive: true,

      run: async () => {
        const result = await rebootHikDevice({ deviceId: device._id });
        return result.ok
          ? { ok: true }
          : { ok: false, error: result.error ?? "Yeniden başlatma başarısız" };
      },
    });
  };

  const handleTriggerIdeSync = () => {
    setPendingAction({
      id: "triggerIdeSync",
      title: "Panel senkronu tetiklensin mi?",
      description: "Panel senkronu komutu gönderilecek.",

      run: async () => {
        const result = await triggerIdeSync({ deviceId: device._id });
        return result.ok
          ? { ok: true, queued: true }
          : {
              ok: false,
              error: result.error ?? "Senkron komutu kuyruğa alınamadı",
            };
      },
    });
  };

  return {
    busy,
    pending,
    pendingAction,
    setPendingAction,
    runConfirmed,
    longRunning,
    capturedCard,
    reconcileSummary,
    handleFetchCapabilities,
    handleFetchWorkStatus,
    handleReconcile,
    handleBackfill,
    handleCaptureCard,
    handleFetchReaderCfg,
    handleOpenDoor,
    handleReboot,
    handleTriggerIdeSync,
  };
}
