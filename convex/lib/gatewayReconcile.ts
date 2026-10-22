import { internal } from "../_generated/api";
import { type ActionCtx } from "../_generated/server";
import { isProjectAllowed, isManager } from "./auth";
import type { Doc, Id } from "../_generated/dataModel";
import {
  searchCardsOnDevice,
  searchFacesOnDevice,
  searchFingerprintsOnDevice,
  type FaceRecord,
  type FingerprintRecord,
  type SearchCardInfo,
} from "./hikGateway";
import { diffIds } from "./reconcileMath";
import { auditDeviceCommand } from "./gatewayCommand";

export async function collectAllPages<TItem, TPage extends DrainPage>(opts: {
  label: string;
  deviceId: Id<"devices">;
  maxPages: number;
  loadPage: (position: number) => Promise<TPage>;
  itemsFromPage: (page: TPage) => TItem[];
}): Promise<{ ok: true; items: TItem[] } | { ok: false; items: TItem[]; error?: string }> {
  const items: TItem[] = [];
  let position = 0;
  let pageCount = 0;

  while (pageCount < opts.maxPages) {
    const page = await opts.loadPage(position);
    if (!page.ok) {
      return { ok: false, items, error: page.error };
    }

    items.push(...opts.itemsFromPage(page));
    pageCount++;
    if (page.numMatches === 0 || !page.hasMore) break;
    position = page.nextPosition;
  }

  if (pageCount >= opts.maxPages) {
    console.warn(
      `[hik-reconcile] ${opts.label} maxPages=${opts.maxPages} aşıldı, device=${opts.deviceId}`,
    );
  }

  return { ok: true, items };
}

type DrainPage = {
  ok: boolean;
  numMatches: number;
  nextPosition: number;
  hasMore: boolean;
  error?: string;
};

type GatewayRoster = {
  cards: readonly string[];
  faces: readonly string[];
  fingerprints: readonly string[];
};

/** Girdiler aynen karşılaştırılır; normalizasyon roster kaynaklarına aittir. */
export function diffGatewayRosters(expected: GatewayRoster, onDevice: GatewayRoster) {
  const { cards: expectedCards, faces: expectedFaces, fingerprints: expectedFingerprints } = expected;
  const { cards: onDeviceCards, faces: onDeviceFaces, fingerprints: onDeviceFingerprints } = onDevice;
  // ── Farkları hesapla ────────────────────────────────────────────────────
  // diffIds(oldIds=expected, newIds=onDevice)
  //   removed = expected'da var ama cihazda yok = expectedNotOnDevice
  //   added   = cihazda var ama expected'da yok = onDeviceNotExpected
  const cardDiff = diffIds(expectedCards, onDeviceCards);
  const faceDiff = diffIds(expectedFaces, onDeviceFaces);
  const fingerprintDiff = diffIds(expectedFingerprints, onDeviceFingerprints);

  return {
    // Kart
    expectedCount: expectedCards.length,
    onDeviceCount: onDeviceCards.length,
    onDeviceNotExpected: cardDiff.added,
    expectedNotOnDevice: cardDiff.removed,
    // Yüz
    faceExpectedCount: expectedFaces.length,
    faceOnDeviceCount: onDeviceFaces.length,
    faceOnDeviceNotExpected: faceDiff.added,
    faceExpectedNotOnDevice: faceDiff.removed,
    // Parmak izi
    fingerprintExpectedCount: expectedFingerprints.length,
    fingerprintOnDeviceCount: onDeviceFingerprints.length,
    fingerprintOnDeviceNotExpected: fingerprintDiff.added,
    fingerprintExpectedNotOnDevice: fingerprintDiff.removed,
  };
}

export async function runReconcileDevice(
  ctx: ActionCtx & { user: Doc<"users"> },
  args: { deviceId: Id<"devices"> }
): Promise<{
    ok: boolean;
    // Kart diff
    expectedCount: number;
    onDeviceCount: number;
    onDeviceNotExpected: string[];
    expectedNotOnDevice: string[];
    // Yüz diff
    faceExpectedCount: number;
    faceOnDeviceCount: number;
    faceOnDeviceNotExpected: string[];
    faceExpectedNotOnDevice: string[];
    // Parmak izi diff
    fingerprintExpectedCount: number;
    fingerprintOnDeviceCount: number;
    fingerprintOnDeviceNotExpected: string[];
    fingerprintExpectedNotOnDevice: string[];
    error?: string;
  }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const device = await ctx.runQuery(internal.devices.getByIdInternal, {
    id: args.deviceId,
  });
  /** Boş diff — hata dönüşleri için sıfır-değer helper. */
  const emptyDiff = () => ({
    expectedCount: 0,
    onDeviceCount: 0,
    onDeviceNotExpected: [] as string[],
    expectedNotOnDevice: [] as string[],
    faceExpectedCount: 0,
    faceOnDeviceCount: 0,
    faceOnDeviceNotExpected: [] as string[],
    faceExpectedNotOnDevice: [] as string[],
    fingerprintExpectedCount: 0,
    fingerprintOnDeviceCount: 0,
    fingerprintOnDeviceNotExpected: [] as string[],
    fingerprintExpectedNotOnDevice: [] as string[],
  });

  if (!device) {
    return { ok: false, ...emptyDiff(), error: "Cihaz bulunamadı" };
  }
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { ok: false, ...emptyDiff(), error: "Bu cihaza erişim yetkiniz yok" };
  }
  if (!isManager(ctx.user)) {
    return { ok: false, ...emptyDiff(), error: "Bu işlem için yönetici yetkisi gerekiyor" };
  }
  if (device.hikTransport !== "gateway") {
    return { ok: false, ...emptyDiff(), error: "Bu işlem yalnızca gateway transport'ta desteklenir" };
  }
  if (!device.hikDevIndex) {
    return { ok: false, ...emptyDiff(), error: "Cihaz gateway'e kayıtlı değil (önce 'Gateway'e Kaydet' tıkla)" };
  }
  const devIndex = device.hikDevIndex;
  return await auditDeviceCommand(ctx, args.deviceId, "Eşitlik kontrolü", async (): Promise<{
      ok: boolean;
      // Kart diff
      expectedCount: number;
      onDeviceCount: number;
      onDeviceNotExpected: string[];
      expectedNotOnDevice: string[];
      // Yüz diff
      faceExpectedCount: number;
      faceOnDeviceCount: number;
      faceOnDeviceNotExpected: string[];
      faceExpectedNotOnDevice: string[];
      // Parmak izi diff
      fingerprintExpectedCount: number;
      fingerprintOnDeviceCount: number;
      fingerprintOnDeviceNotExpected: string[];
      fingerprintExpectedNotOnDevice: string[];
      error?: string;
  }> => {

    // ── Beklenen roster'lar ─────────────────────────────────────────────────
    const [expectedCards, expectedFaces, expectedFingerprints] = await Promise.all([
      ctx.runQuery(internal.devices.getHikAuthorizedCardNumbers, { deviceId: args.deviceId }) as Promise<string[]>,
      ctx.runQuery(internal.devices.getHikDeviceFaceRoster, { deviceId: args.deviceId }) as Promise<string[]>,
      ctx.runQuery(internal.devices.getHikDeviceFingerprintRoster, { deviceId: args.deviceId }) as Promise<string[]>,
    ]);

    const MAX_RECONCILE_PAGES = 100;
    const now = Date.now();
    const [cardDrain, faceDrain, fingerprintDrain] = await Promise.all([
      collectAllPages<string, {
        ok: boolean;
        cards: SearchCardInfo[];
        numMatches: number;
        nextPosition: number;
        hasMore: boolean;
        error?: string;
      }>({
        label: "kart",
        deviceId: args.deviceId,
        maxPages: MAX_RECONCILE_PAGES,
        loadPage: (position) =>
          searchCardsOnDevice(devIndex, {
            searchID: `reconcile-card-${args.deviceId}-${now}`,
            position,
            maxResults: 50,
          }),
        itemsFromPage: (page) => page.cards.map((card) => card.cardNo),
      }),
      collectAllPages<string, {
        ok: boolean;
        faces: FaceRecord[];
        numMatches: number;
        nextPosition: number;
        hasMore: boolean;
        error?: string;
      }>({
        label: "yüz",
        deviceId: args.deviceId,
        maxPages: MAX_RECONCILE_PAGES,
        loadPage: (position) =>
          searchFacesOnDevice(devIndex, {
            searchID: `reconcile-face-${args.deviceId}-${now}`,
            position,
            maxResults: 50,
          }),
        itemsFromPage: (page) =>
          page.faces.flatMap((face) => {
            // VERIFY: cihazdaki yüz kaydında employeeNo mu yoksa FPID mi kullanılan tanımlayıcı?
            // hikvisionSync.ts addFaceToDevice'de FPID: employeeNo set ediliyor → employeeNo öncelikli.
            const id = face.employeeNo ?? face.FPID;
            return id ? [id] : [];
          }),
      }),
      collectAllPages<string, {
        ok: boolean;
        fingerprints: FingerprintRecord[];
        numMatches: number;
        nextPosition: number;
        hasMore: boolean;
        error?: string;
      }>({
        label: "parmak izi",
        deviceId: args.deviceId,
        maxPages: MAX_RECONCILE_PAGES,
        loadPage: (position) =>
          searchFingerprintsOnDevice(devIndex, {
            searchID: `reconcile-fp-${args.deviceId}-${now}`,
            position,
            maxResults: 50,
          }),
        itemsFromPage: (page) => page.fingerprints.map((fp) => fp.employeeNo),
      }),
    ]);

    if (!cardDrain.ok) {
      return {
        ok: false,
        ...emptyDiff(),
        expectedCount: expectedCards.length,
        error: `Cihaz kart listesi alınamadı: ${cardDrain.error ?? "bilinmeyen hata"}`,
      };
    }
    if (!faceDrain.ok) {
      // Yüz desteği olmayan cihazlar HTTP 4xx dönebilir — uyarı logla, kart sonucunu yine de dön.
      console.warn(`[hik-reconcile] yüz listesi alınamadı, device=${args.deviceId}: ${faceDrain.error ?? "?"}`);
    }
    if (!fingerprintDrain.ok) {
      console.warn(`[hik-reconcile] parmak izi listesi alınamadı, device=${args.deviceId}: ${fingerprintDrain.error ?? "?"}`);
    }

    const onDeviceCards = cardDrain.items;
    const onDeviceFaces = faceDrain.items;
    const onDeviceFingerprints = fingerprintDrain.items;

    return {
      ok: true,
      ...diffGatewayRosters(
        { cards: expectedCards, faces: expectedFaces, fingerprints: expectedFingerprints },
        { cards: onDeviceCards, faces: onDeviceFaces, fingerprints: onDeviceFingerprints },
      ),
    };
  }, (result) => `cihazda ${result.onDeviceCount}, eksik ${result.expectedNotOnDevice.length}, fazla ${result.onDeviceNotExpected.length}`);
}
