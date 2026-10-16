import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { relayConfig, signWakeRequest } from "../lib/hikWake";

export const wake = internalAction({
  args: { bridgeId: v.id("hikBridges") },
  handler: async (_ctx, { bridgeId }) => {
    const config = relayConfig(process.env);
    if (!config) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const rawBody = JSON.stringify({ bridgeId });
      const ts = Date.now();
      const signature = await signWakeRequest(config.secret, ts, rawBody);
      const response = await fetch(`${config.url}/hik-bridge/wake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ngs-Ts": String(ts),
          "X-Ngs-Signature": signature,
        },
        body: rawBody,
        signal: controller.signal,
      });
      if (!response.ok) console.warn("[hik-bridge/wake] relay HTTP", response.status);
    } catch {
      // Relay hatası işi engellemez; emniyet poll'u kuyruğu yeniden çeker.
      console.warn("[hik-bridge/wake] relay isteği başarısız veya zaman aşımına uğradı");
    } finally {
      clearTimeout(timeout);
    }
  },
});
