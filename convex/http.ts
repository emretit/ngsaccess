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
      const { user_id, serial, deviceIp, bodyForLog } = parseCardReaderBody(
        raw,
        contentType
      );

      const accessEvent =
        (bodyForLog as Record<string, unknown>).AccessControllerEvent as
          | Record<string, unknown>
          | undefined;
      const subEventType = accessEvent?.subEventType;
      const dateTime =
        (bodyForLog as Record<string, unknown>).dateTime as string | undefined;

      // Her POST'ta (heartbeat dahil) lastSeen güncelle — cihaz "online" görünsün
      if (serial || deviceIp) {
        await ctx.runMutation(internal.devices.updateLastSeen, {
          deviceSerial: serial ?? undefined,
          deviceIp: deviceIp ?? undefined,
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
        subEventType: subEventType ?? "(yok)",
        dateTime: dateTime ?? "(yok)",
      });

      const result = await ctx.runMutation(
        internal.cardReadings.processCardReading,
        {
          cardNo: user_id,
          deviceSerial: serial ?? "",
          deviceIp: deviceIp ?? undefined,
          rawBody: raw.length > 10000 ? raw.slice(0, 10000) : raw,
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
