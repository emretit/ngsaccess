import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
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
      if (authedDevice) {
        const checks: Array<[string, string | undefined, string | undefined]> = [
          ["serial", serial ?? undefined, authedDevice.deviceSerial],
          ["devIndex", hikDevIndex ?? undefined, authedDevice.hikDevIndex],
          ["ehomeID", hikEhomeID ?? undefined, authedDevice.ehomeID],
          ["deviceIp", deviceIp ?? undefined, authedDevice.deviceIp],
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
      if (serial || deviceIp || hikDevIndex || hikEhomeID) {
        await ctx.runMutation(internal.devices.updateLastSeen, {
          deviceSerial: serial ?? undefined,
          deviceIp: deviceIp ?? undefined,
          hikDevIndex: hikDevIndex ?? undefined,
          ehomeID: hikEhomeID ?? undefined,
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
