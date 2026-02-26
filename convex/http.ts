import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Kart okuyucu cihazlarından gelen istekleri işler.
 * Eski server.js /card-reader endpoint'inin Convex karşılığı.
 *
 * Body formatları:
 * - { "user_id,serial": "CARD_NO,DEVICE_SERIAL" }
 * - { "CARD_NO": "CARD_NO,DEVICE_SERIAL" }
 * - { user_id: string, serial: string }
 */
http.route({
  path: "/card-reader",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      let user_id: string | undefined;
      let serial: string | undefined;

      if (body["user_id,serial"] && typeof body["user_id,serial"] === "string") {
        const [cardNumber, deviceSerial] = (body["user_id,serial"] as string).split(",");
        user_id = cardNumber;
        serial = deviceSerial;
      } else if (body.CARD_NO && typeof body.CARD_NO === "string") {
        const [cardNumber, deviceSerial] = (body.CARD_NO as string).split(",");
        user_id = cardNumber;
        serial = deviceSerial;
      } else {
        user_id = body.user_id as string | undefined;
        serial = body.serial as string | undefined;
      }

      if (!user_id) {
        return new Response(
          JSON.stringify({ cevap: "error", error: "user_id missing" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (!serial) {
        return new Response(
          JSON.stringify({ cevap: "error", error: "serial missing" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const result = await ctx.runMutation(internal.cardReadings.processCardReading, {
        cardNo: user_id,
        deviceSerial: serial,
        rawBody: JSON.stringify(body),
      });

      return new Response(JSON.stringify({ cevap: result.granted ? "ok" : "error" }), {
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
