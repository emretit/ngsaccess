"use node";

import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { authedAction } from "../lib/customFunctions";
import { internal } from "../_generated/api";
import { gatewayApiCall } from "../lib/gateway/core";
import { setHttpHostForwarding } from "../lib/gateway/devices";
import { withDeviceToken } from "../lib/cardReaderAuth";
import { auditDeviceCommand } from "../lib/gatewayCommand";
import { requireSelfHostTarget } from "../lib/selfHostTarget";

/** GET by default; write requires explicit true and operator approval before invocation. */
export const forwarding = authedAction({
  args: { write: v.optional(v.boolean()), cursor: v.optional(v.string()), confirmHost: v.optional(v.string()), deviceIds: v.optional(v.array(v.id("devices"))) },
  handler: async (ctx, args): Promise<{ write: boolean; rows: { deviceId: Id<"devices">; name: string; before: string; readStatus: number; written: boolean }[]; isDone: boolean; continueCursor: string }> => {
    if (ctx.user.role !== "super_admin") throw new Error("Süper admin yetkisi gerekli");
    const target = process.env.HIK_FORWARDING_URL;
    if (!target) throw new Error("HIK_FORWARDING_URL gerekli");
    const targetUrl = new URL(target);
    if (targetUrl.protocol !== "https:" || targetUrl.username || targetUrl.password || targetUrl.pathname !== "/card-reader") throw new Error("Geçersiz HIK_FORWARDING_URL");
    if (args.write === true) {
      const site = requireSelfHostTarget(args.confirmHost);
      if (site.origin !== targetUrl.origin) throw new Error("Forwarding hedefi onaylanan deployment ile eşleşmeli");
      if (!args.deviceIds?.length || args.deviceIds.length > 100) throw new Error("Yazma için açık cihaz listesi gerekli (1–100)");
    }
    const selected = new Set(args.deviceIds ?? []);
    const page = await ctx.runQuery(internal.selfHostReconcile.forwardingDevices, { cursor: args.cursor });
    const rows = [];
    for (const device of page.page) {
      if (!device.hikDevIndex) {
        rows.push({ deviceId: device._id, name: device.name, before: "gateway kaydı yok", readStatus: 0, written: false });
        continue;
      }
      const before = await gatewayApiCall("/ISAPI/Event/notification/httpHosts", "GET", undefined, device.hikDevIndex);
      // Never expose the embedded per-device token in action responses or logs.
      const hosts = before.raw.replace(/([?&](?:amp;)?(?:token|apiToken)=)[^&\s"<>]+/gi, "$1[redacted]");
      if (args.write === true && selected.has(device._id) && before.status >= 200 && before.status < 300) {
        const token = await ctx.runMutation(internal.devices.ensureApiToken, { deviceId: device._id });
        if (!token) throw new Error("Cihaz token alınamadı");
        const result = await auditDeviceCommand(ctx, device._id, "Self-host forwarding güncelle", () => setHttpHostForwarding(device.hikDevIndex ?? "", withDeviceToken(target, token)));
        rows.push({ deviceId: device._id, name: device.name, before: hosts, readStatus: before.status, written: result.ok });
      } else rows.push({ deviceId: device._id, name: device.name, before: hosts, readStatus: before.status, written: false });
    }
    return { write: args.write === true, rows, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});
