import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { parseCardReaderBody } from "./lib/cardReaderParse";

const http = httpRouter();

auth.addHttpRoutes(http);

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

      const eventType =
        (bodyForLog as Record<string, unknown>).eventType as string | undefined;
      const dateTime =
        (bodyForLog as Record<string, unknown>).dateTime as string | undefined;
      const accessEvent =
        (bodyForLog as Record<string, unknown>).AccessControllerEvent as
          | Record<string, unknown>
          | undefined;
      const subEventType = accessEvent?.subEventType;

      const parsedList = {
        "Kart no (cardNo)": user_id ?? "(yok)",
        "Cihaz seri (serial)": serial ?? "(yok)",
        "Cihaz IP (deviceIp)": deviceIp ?? "(yok)",
        "Event tipi": eventType ?? "(yok)",
        "Alt tip (subEventType)": subEventType ?? "(yok)",
        "Tarih/saat": dateTime ?? "(yok)",
      };
      console.log("[card-reader] parse sonucu (liste):");
      Object.entries(parsedList).forEach(([k, v]) =>
        console.log(`  ${k}: ${v}`)
      );

      if (!user_id) {
        const payload = {
          cevap: "error",
          error: "user_id missing",
          parsed: parsedList,
        };
        console.warn("[card-reader] user_id missing");
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (!serial && !deviceIp) {
        const payload = {
          cevap: "error",
          error: "serial and deviceIp missing",
          parsed: parsedList,
        };
        console.warn("[card-reader] serial and deviceIp missing");
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const result = await ctx.runMutation(
        internal.cardReadings.processCardReading,
        {
          cardNo: user_id,
          deviceSerial: serial ?? "",
          deviceIp: deviceIp ?? undefined,
          rawBody: raw.length > 10000 ? raw.slice(0, 10000) : raw,
        }
      );

      console.log(
        "[card-reader] sonuç:",
        result.granted ? "izin_verildi" : "reddedildi"
      );
      return new Response(
        JSON.stringify({ cevap: result.granted ? "ok" : "error" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
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
