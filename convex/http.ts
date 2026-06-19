import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { parseCardReaderBody } from "./lib/cardReaderParse";

const http = httpRouter();

auth.addHttpRoutes(http);

/** Tarayıcı/curl ile: deployment ve HTTP route’un açık olduğunu doğrular (Hikvision POST kullanmaz). */
http.route({
  path: "/card-reader",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        ok: true,
        message:
          "Kart olayları için cihaz bu adrese POST atmalı (Hikvision httpHosts).",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

/**
 * Kart okuyucu (Hikvision vb.) event'leri: body parse → processCardReading.
 * Bkz. docs/TABLO_PARSE_UYUMLULUK.md, docs/YAPILACAKLAR_VE_TEST.md
 */
http.route({
  path: "/card-reader",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const contentType = request.headers.get("Content-Type");
      const raw = await request.text();
      const parsed = parseCardReaderBody(raw, contentType);
      const {
        user_id,
        serial,
        deviceIp,
        hikDevIndex,
        hikMajorEventType,
        hikSubEventType,
        hikCurrentVerifyMode,
        hikSerialNo,
        hikFrontSerialNo,
        hikDateTime,
        hikPictureURL,
        hikMask,
        hikHelmet,
        hikTemperature,
        hikEventState,
        hikEhomeID,
        ideIoId,
        ideUuid,
        ideResult,
        ideTime,
      } = parsed;

      const authHeader = request.headers.get("Authorization") ?? "";
      const bearerToken = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;
      const authedDevice = bearerToken
        ? await ctx.runQuery(internal.devices.getByApiToken, { token: bearerToken })
        : null;
      if (bearerToken && !authedDevice) {
        // Backwards-compat dönemi: warn log, eski serial/IP lookup'a düş
        console.warn("[card-reader] geçersiz apiToken, serial/IP'ye düşülüyor", {
          token: bearerToken.slice(0, 8) + "…",
        });
      }
      if (!bearerToken) {
        console.warn(
          "[card-reader] Authorization header yok — eski serial/IP lookup kullanılıyor (deprecated)",
        );
      }

      // Token doğrulandıysa: request'teki tüm cihaz tanımlayıcıları token sahibi cihazla
      // eşleşmeli; en az bir tanımlayıcı eşleşmeli (saldırgan hepsini omit ederek farklı
      // tenant cihazına yazamasın). Eşleşmezse cross-tenant attempt → 403.
      //
      // localBridge istisnası: bu cihazların event'lerini LAN bridge, cihazın per-device
      // apiToken'ı ile basar; token zaten tek bir cihaza bağlı (getByApiToken), dolayısıyla
      // cross-tenant imkansız. Ayrıca bridge serial/devIndex/ehome göndermez (yalnız IP),
      // tanımlayıcı-eşleşme guard'ı bu cihazlarda her event'i yanlışlıkla 403'lerdi.
      if (authedDevice && authedDevice.hikTransport !== "localBridge") {
        const checks: Array<[string, string | undefined, string | undefined]> = [
          ["serial", serial ?? undefined, authedDevice.deviceSerial],
          ["devIndex", hikDevIndex ?? undefined, authedDevice.hikDevIndex],
          ["ehomeID", hikEhomeID ?? undefined, authedDevice.ehomeID],
          ["deviceIp", deviceIp ?? undefined, authedDevice.deviceIp],
          ["ideUuid", ideUuid ?? undefined, authedDevice.ideUuid],
        ];
        const mismatches: string[] = [];
        let matched = 0;
        for (const [label, reqVal, tokVal] of checks) {
          if (!reqVal || !tokVal) continue;
          if (reqVal !== tokVal) mismatches.push(`${label}=${reqVal} vs token=${tokVal}`);
          else matched++;
        }
        if (mismatches.length > 0 || matched === 0) {
          console.warn("[card-reader] cross-tenant attempt reddedildi", {
            mismatches,
            matched,
          });
          return new Response(
            JSON.stringify({ cevap: "error", error: "device mismatch" }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }
      }

      // Her POST'ta (heartbeat dahil) lastSeen güncelle — cihaz "online" görünsün
      if (serial || deviceIp || hikDevIndex || hikEhomeID || ideUuid) {
        await ctx.runMutation(internal.devices.updateLastSeen, {
          deviceSerial: serial ?? undefined,
          deviceIp: deviceIp ?? undefined,
          hikDevIndex: hikDevIndex ?? undefined,
          ehomeID: hikEhomeID ?? undefined,
          ideUuid: ideUuid ?? undefined,
        });
      }

      if (!user_id) {
        // Heartbeat — sessizce atla, log basma
        return new Response(JSON.stringify({ cevap: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      console.log("[card-reader] kart okundu", {
        cardNo: user_id,
        serial: serial ?? "(yok)",
        deviceIp: deviceIp ?? "(yok)",
        hikDevIndex: hikDevIndex ?? "(yok)",
        major: hikMajorEventType ?? "(yok)",
        sub: hikSubEventType ?? "(yok)",
        verifyMode: hikCurrentVerifyMode ?? "(yok)",
        dateTime: hikDateTime ?? "(yok)",
      });

      const result = await ctx.runMutation(
        internal.cardReadings.processCardReading,
        {
          cardNo: user_id,
          deviceSerial: serial ?? "",
          deviceIp: deviceIp ?? undefined,
          rawBody: raw.length > 10000 ? raw.slice(0, 10000) : raw,
          hikDevIndex: hikDevIndex ?? undefined,
          hikEhomeID: hikEhomeID ?? undefined,
          hikMajorEventType: hikMajorEventType ?? undefined,
          hikSubEventType: hikSubEventType ?? undefined,
          hikCurrentVerifyMode: hikCurrentVerifyMode ?? undefined,
          hikSerialNo: hikSerialNo ?? undefined,
          hikFrontSerialNo: hikFrontSerialNo ?? undefined,
          hikDateTime: hikDateTime ?? undefined,
          hikPictureURL: hikPictureURL ?? undefined,
          hikMask: hikMask ?? undefined,
          hikHelmet: hikHelmet ?? undefined,
          hikTemperature: hikTemperature ?? undefined,
          hikEventState: hikEventState ?? undefined,
          ideUuid: ideUuid ?? undefined,
          ideIoId: ideIoId ?? undefined,
          ideResult: ideResult ?? undefined,
          ideTime: ideTime ?? undefined,
        }
      );

      console.log("[card-reader] sonuç:", result.granted ? "izin_verildi" : "reddedildi");
      // Remote Verification: Hikvision checkResult ("success"|"failed") + cevap (geriye uyumluluk)
      const payload = {
        cevap: result.granted ? "ok" : "error",
        checkResult: result.granted ? "success" : "failed",
      };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Card reader error:", error);
      return new Response(
        JSON.stringify({ cevap: "error", error: "system error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ────────────────────────────────────────────────────────────────────
// IDE Smart MQTT bridge köprüsü (Hetzner ide-mqtt-bridge daemon ↔ Convex).
// Bridge tek secret (IDE_BRIDGE_SECRET) ile authenticate olur; broker'dan
// güvenilir gelen event/komut akışını taşır. Convex serverless MQTT tutamaz,
// bu yüzden komutlar idePendingOperations kuyruğunda durur, bridge poll eder.
// ────────────────────────────────────────────────────────────────────

/** Bridge Bearer secret doğrulaması. Geçersizse 401 Response döner, geçerliyse null. */
function checkBridgeAuth(request: Request): Response | null {
  const expected = process.env.IDE_BRIDGE_SECRET;
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!expected || !token || token !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Bridge → Convex: panel event'i (MQTT topic + ham body). /card-reader'ın IDE
 * akışını yeniden kullanır ama panel-token cross-tenant guard'ı yerine bridge
 * secret'ı kullanır (cihaz ideUuid ile bulunur).
 */
http.route({
  path: "/ide-bridge/event",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const unauth = checkBridgeAuth(request);
    if (unauth) return unauth;
    try {
      const { body } = (await request.json()) as { topic?: string; body?: string };
      const raw = typeof body === "string" ? body : JSON.stringify(body ?? {});
      const parsed = parseCardReaderBody(raw, "application/json");
      const { user_id, ideUuid, ideIoId, ideResult, ideTime } = parsed;

      // Bu route YALNIZCA IDE Smart paneli event'leri içindir → ideUuid zorunlu.
      // Yoksa cihaz çözülemez ve processCardReading kartı yanlış branch'te (token/
      // genel kart) işleyip ideResult/ideIoId'yi yok sayardı.
      if (!ideUuid) {
        console.warn("[ide-bridge/event] ideUuid yok, atlanıyor", { rawHead: raw.slice(0, 120) });
        return jsonResponse({ ok: false, error: "ideUuid required" }, 400);
      }
      await ctx.runMutation(internal.devices.updateLastSeen, { ideUuid });
      // Heartbeat / kart no yok → sadece lastSeen.
      if (!user_id) return jsonResponse({ ok: true, kind: "heartbeat" });

      const result = await ctx.runMutation(internal.cardReadings.processCardReading, {
        cardNo: user_id,
        deviceSerial: "",
        rawBody: raw.length > 10000 ? raw.slice(0, 10000) : raw,
        ideUuid: ideUuid ?? undefined,
        ideIoId: ideIoId ?? undefined,
        ideResult: ideResult ?? undefined,
        ideTime: ideTime ?? undefined,
      });
      return jsonResponse({ ok: true, granted: result.granted });
    } catch (error) {
      console.error("[ide-bridge/event] error:", error);
      return jsonResponse({ ok: false, error: "system error" }, 500);
    }
  }),
});

/** Bridge → Convex: pending komutları çek (materialize edilmiş, msx-id bridge'de üretilir). */
http.route({
  path: "/ide-bridge/poll",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const unauth = checkBridgeAuth(request);
    if (unauth) return unauth;
    const { max } = (await request.json().catch(() => ({}))) as { max?: number };
    const result = await ctx.runQuery(internal.ideSync.listPendingForBridge, {
      max: typeof max === "number" ? max : undefined,
    });
    return jsonResponse(result);
  }),
});

/** Bridge → Convex: komut panele publish edildi (status sent, msxId yaz). */
http.route({
  path: "/ide-bridge/sent",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const unauth = checkBridgeAuth(request);
    if (unauth) return unauth;
    const { opId, msxId } = (await request.json()) as { opId?: string; msxId?: number };
    if (!opId || typeof msxId !== "number") return jsonResponse({ ok: false, error: "opId+msxId gerekli" }, 400);
    await ctx.runMutation(internal.ideSync.markSent, {
      opId: opId as Id<"idePendingOperations">,
      msxId,
    });
    return jsonResponse({ ok: true });
  }),
});

/** Bridge → Convex: panel komut sonucu (acked/failed/timeout). */
http.route({
  path: "/ide-bridge/ack",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const unauth = checkBridgeAuth(request);
    if (unauth) return unauth;
    const { opId, msxId, result, message } = (await request.json()) as {
      opId?: string;
      msxId?: number;
      result?: string;
      message?: string;
    };
    if (!opId) return jsonResponse({ ok: false, error: "opId gerekli" }, 400);
    const normalized: "success" | "fail" | "timeout" =
      result === "success" ? "success" : result === "timeout" ? "timeout" : "fail";
    await ctx.runMutation(internal.ideSync.markAck, {
      opId: opId as Id<"idePendingOperations">,
      msxId: typeof msxId === "number" ? msxId : undefined,
      result: normalized,
      message,
    });
    return jsonResponse({ ok: true });
  }),
});

function bridgeBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
}

/**
 * Windows Hikvision bridge -> Convex: localBridge cihazı için pending SDK işlerini çek.
 * Auth per-device apiToken ile yapılır; token sahibi olmayan cihazın op'ları dönmez.
 */
http.route({
  path: "/hik-bridge/poll",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = bridgeBearerToken(request);
    if (!token) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    const body = (await request.json().catch(() => ({}))) as { max?: unknown };
    const result = await ctx.runMutation(internal.hikvisionSync.claimLocalBridgeOperations, {
      token,
      max: typeof body.max === "number" ? body.max : undefined,
    });
    if (!result.ok) return jsonResponse(result, 401);
    return jsonResponse(result);
  }),
});

/**
 * Windows Hikvision bridge -> Convex: claimed SDK işini done/failed olarak kapat.
 */
http.route({
  path: "/hik-bridge/ack",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = bridgeBearerToken(request);
    if (!token) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    const body = (await request.json()) as {
      opId?: string;
      ok?: boolean;
      message?: string;
    };
    if (!body.opId || typeof body.ok !== "boolean") {
      return jsonResponse({ ok: false, error: "opId+ok gerekli" }, 400);
    }
    const result = await ctx.runMutation(internal.hikvisionSync.ackLocalBridgeOperation, {
      token,
      opId: body.opId as Id<"hikPendingOperations">,
      ok: body.ok,
      // null → undefined: Convex v.optional(v.string()) açık null'ı reddeder; başarılı
      // ack'te bridge message=null gönderir, bu satır olmadan op processing'te kalırdı.
      message: typeof body.message === "string" ? body.message : undefined,
    });
    if (!result.ok && result.error === "unauthorized") {
      return jsonResponse(result, 401);
    }
    if (!result.ok) return jsonResponse(result, 404);
    return jsonResponse(result);
  }),
});

/**
 * Tek-yer modeli: Windows bridge -> Convex. Bir bridge token ile o projedeki TÜM
 * localBridge cihazlarının roster'ı (IP/port/kullanıcı/şifre) + bekleyen SDK işleri.
 * Panel bilgileri bridge'de değil ngsplus'ta yönetilir.
 */
http.route({
  path: "/hik-bridge/roster",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = bridgeBearerToken(request);
    if (!token) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    const body = (await request.json().catch(() => ({}))) as { max?: unknown };
    const result = await ctx.runMutation(internal.hikBridge.claimBridgeRoster, {
      token,
      max: typeof body.max === "number" ? body.max : undefined,
    });
    if (!result.ok) return jsonResponse(result, 401);
    return jsonResponse(result);
  }),
});

/**
 * Tek-yer modeli: bridge token ile claimed SDK işini done/failed kapat.
 */
http.route({
  path: "/hik-bridge/roster-ack",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = bridgeBearerToken(request);
    if (!token) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    const body = (await request.json()) as {
      opId?: string;
      ok?: boolean;
      message?: string;
    };
    if (!body.opId || typeof body.ok !== "boolean") {
      return jsonResponse({ ok: false, error: "opId+ok gerekli" }, 400);
    }
    const result = await ctx.runMutation(internal.hikBridge.ackBridgeOperation, {
      token,
      opId: body.opId as Id<"hikPendingOperations">,
      ok: body.ok,
      // null → undefined: Convex v.optional(v.string()) açık null'ı reddeder; başarılı
      // ack'te bridge message=null gönderir, bu satır olmadan op processing'te kalırdı.
      message: typeof body.message === "string" ? body.message : undefined,
    });
    if (!result.ok && result.error === "unauthorized") {
      return jsonResponse(result, 401);
    }
    if (!result.ok) return jsonResponse(result, 404);
    return jsonResponse(result);
  }),
});

/**
 * Relay onay endpoint'i - eski /confirm-relay uyumluluğu için
 */
http.route({
  path: "/confirm-relay",
  method: "POST",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ onay: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
