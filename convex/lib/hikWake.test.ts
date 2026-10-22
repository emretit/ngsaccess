import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { wake } from "../actions/hikBridgeWake";
import type { MutationCtx } from "../_generated/server";
import { scheduleBridgeWakeForProject } from "../hikBridge";
import {
  earliestPendingRetryAt,
  hmacHex,
  NEXT_POLL_SECONDS,
  planNextWake,
  relayConfig,
  secondsUntil,
  signWakeRequest,
  streamTicket,
} from "./hikWake";

vi.mock("./customFunctions", () => ({
  authedMutation: (config: unknown) => config,
  authedQuery: (config: unknown) => config,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Hik relay imzaları", () => {
  const secret = "test-only-secret-0123456789abcdef";
  const expected = (message: string) => createHmac("sha256", secret).update(message).digest("hex");
  it("Web Crypto HMAC'i Node SHA-256 ile aynıdır", async () => {
    expect(await hmacHex(secret, "İstanbul / wake")).toBe(expected("İstanbul / wake"));
    expect(await hmacHex(secret, "")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("bilet ve istek tam sözleşme metnini imzalar", async () => {
    expect(await streamTicket(secret, "bridge-1")).toBe(expected("stream.bridge-1"));
    const rawBody = '{"bridgeId":"bridge-1"}';
    expect(await signWakeRequest(secret, 12345, rawBody)).toBe(expected(`12345.${rawBody}`));
  });
});

describe("uyandırma planı", () => {
  it("ilk işi hemen planlar", () => expect(planNextWake(10_000, undefined)).toEqual({ schedule: true, fireAt: 10_000 }));
  it("aynı anda veya ileride planlanmış iş kapsar", () => {
    expect(planNextWake(10_000, 10_000)).toEqual({ schedule: false });
    expect(planNextWake(10_000, 11_000)).toEqual({ schedule: false });
  });
  it("iki saniye içindeki ardışık işi sınırda planlar", () => expect(planNextWake(10_500, 10_000)).toEqual({ schedule: true, fireAt: 12_000 }));
  it("iki saniye ve sonrasında hemen planlar", () => {
    expect(planNextWake(12_000, 10_000)).toEqual({ schedule: true, fireAt: 12_000 });
    expect(planNextWake(13_000, 10_000)).toEqual({ schedule: true, fireAt: 13_000 });
    expect(planNextWake(10_500, 10_000, 1000)).toEqual({ schedule: true, fireAt: 11_000 });
  });
});

describe("retry ipucu", () => {
  it("yalnız due olmayan ve deneme hakkı kalan en erken işi seçer", () => {
    const ops = [
      { nextRetryAt: 900, attemptCount: 1 },
      { nextRetryAt: 1_500, attemptCount: 5 },
      { nextRetryAt: 2_000, attemptCount: 2 },
      { nextRetryAt: 1_800, attemptCount: 1 },
      { attemptCount: 0 },
    ];
    expect(earliestPendingRetryAt(ops, 1_000, 5)).toBe(1_800);
    expect(earliestPendingRetryAt([{ nextRetryAt: 500, attemptCount: 0 }], 1_000, 5)).toBeNull();
  });
  it("saniyeyi yukarı yuvarlar, en az 1 döner", () => {
    expect(secondsUntil(null, 1_000)).toBeNull();
    expect(secondsUntil(7_001, 1_000)).toBe(7);
    expect(secondsUntil(7_500, 1_000)).toBe(7);
    expect(secondsUntil(1_200, 1_000)).toBe(1);
  });
});

describe("relay yapılandırması", () => {
  it("eksik veya boş ayarlarda kapalıdır", () => {
    for (const env of [{}, { HIK_RELAY_URL: "https://relay.example" }, { HIK_RELAY_SECRET: "secret" },
      { HIK_RELAY_URL: "", HIK_RELAY_SECRET: "secret" }, { HIK_RELAY_URL: "https://relay.example", HIK_RELAY_SECRET: "  " }]) {
      expect(relayConfig(env)).toBeNull();
    }
  });
  it("sondaki eğik çizgileri kırpar ve emniyet poll'u 900 saniyedir", () => {
    expect(relayConfig({ HIK_RELAY_URL: "https://relay.example///", HIK_RELAY_SECRET: "secret" })).toEqual({ url: "https://relay.example", secret: "secret" });
    expect(NEXT_POLL_SECONDS).toBe(900);
  });
});

// Bu testler yalnız kullanılan Convex bağlam yüzeyini taklit eder; canlı DB'ye erişmez.
const bridgeId = "bridge-test" as Id<"hikBridges">;
const projectId = "project-test" as Id<"projects">;
describe("proje uyandırması", () => {
  it("relay kapalı veya proje yoksa veritabanına bile erişmez", async () => {
    vi.stubEnv("HIK_RELAY_URL", "");
    vi.stubEnv("HIK_RELAY_SECRET", "");
    const ctx = {} as MutationCtx;
    await expect(scheduleBridgeWakeForProject(ctx, projectId)).resolves.toBeUndefined();
    await expect(scheduleBridgeWakeForProject(ctx, undefined)).resolves.toBeUndefined();
  });
  it("planlanmış köprüyü atlar ve diğerini iki saniye sınırında planlar", async () => {
    vi.stubEnv("HIK_RELAY_URL", "https://relay.example");
    vi.stubEnv("HIK_RELAY_SECRET", "test-only");
    vi.spyOn(Date, "now").mockReturnValue(10_500);
    const patch = vi.fn();
    const runAt = vi.fn();
    const take = vi.fn().mockResolvedValue([
      { _id: bridgeId, nextWakeAt: 10_000 },
      { _id: "covered", nextWakeAt: 12_000 },
    ]);
    const ctx = {
      db: { query: () => ({ withIndex: () => ({ take }) }), patch },
      scheduler: { runAt },
    } as unknown as MutationCtx;
    await scheduleBridgeWakeForProject(ctx, projectId);
    expect(take).toHaveBeenCalledWith(10);
    expect(patch).toHaveBeenCalledExactlyOnceWith(bridgeId, { nextWakeAt: 12_000 });
    expect(runAt).toHaveBeenCalledOnce();
    expect(runAt.mock.calls[0]?.[0]).toBe(12_000);
    expect(runAt.mock.calls[0]?.[2]).toEqual({ bridgeId });
  });
});

const wakeHandler = (wake as unknown as {
  _handler: (ctx: unknown, args: { bridgeId: Id<"hikBridges"> }) => Promise<void>;
})._handler;

describe("relay action", () => {
  function enableRelay() {
    vi.stubEnv("HIK_RELAY_URL", "https://relay.example/");
    vi.stubEnv("HIK_RELAY_SECRET", "test-only-secret");
  }
  it("ham JSON gövdesini ve zaman damgasını imzalayarak gönderir", async () => {
    enableRelay();
    vi.spyOn(Date, "now").mockReturnValue(12345);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true,"delivered":0}'));
    vi.stubGlobal("fetch", fetchMock);
    await wakeHandler({}, { bridgeId });
    const rawBody = JSON.stringify({ bridgeId });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("https://relay.example/hik-bridge/wake", {
      method: "POST", body: rawBody, signal: expect.any(AbortSignal),
      headers: {
        "Content-Type": "application/json", "X-Ngs-Ts": "12345",
        "X-Ngs-Signature": createHmac("sha256", "test-only-secret").update(`12345.${rawBody}`).digest("hex"),
      },
    });
  });
  it("yapılandırma yoksa ağ çağrısı yapmaz", async () => {
    vi.stubEnv("HIK_RELAY_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await wakeHandler({}, { bridgeId });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("401, 429 ve ağ hatalarını yutar ve gizli değer loglamaz", async () => {
    enableRelay();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockRejectedValueOnce(new Error("test-only-secret")));
    for (let index = 0; index < 3; index++) {
      await expect(wakeHandler({}, { bridgeId })).resolves.toBeUndefined();
    }
    expect(warn).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("test-only-secret");
  });
  it("üç saniyede isteği iptal eder ve hatayı yutar", async () => {
    enableRelay();
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let notifyStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => { notifyStarted = resolve; });
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      notifyStarted();
    })));
    const pending = wakeHandler({}, { bridgeId });
    await started;
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledOnce();
  });
});
