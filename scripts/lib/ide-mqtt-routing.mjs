import { responseUuid, matchesResponse, boundEvent } from "./ide-mqtt-policy.mjs";

/** Incoming bridge boundary. Dependencies are explicit so provenance has offline regressions. */
export async function routeMqttMessage(topic, buf, {
  pending, loginWaiters, tokenCache, convexPost,
  legacyEvents = false, log = () => {}, dbg = () => {},
}) {
  const raw = buf.toString("utf8");
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* Malformed messages are rejected by topic/source checks below. */
  }

  // Komut response'u mu? (device/publish/<uuid>, msx-id correlate)
  if (responseUuid(topic)) {
    const msxId = parsed?.transaction?.["msx-id"];
    const result = parsed?.payload?.result;
    const message = parsed?.payload?.message ?? null;
    const topicUuid = topic.slice("device/publish/".length);
    dbg(`response received topic=${topic}`);

    // Login response mu? (type=login_response, token taşır) — loginWaiters ile eşle.
    if (msxId != null && loginWaiters.has(msxId)) {
      const w = loginWaiters.get(msxId);
      // Foreign responses must not destroy the legitimate login waiter.
      if (!matchesResponse(topic, parsed, w.uuid)) {
        log(`login response DROP: topic uuid=${topicUuid} beklenen=${w.uuid}`);
        return;
      }
      clearTimeout(w.timer);
      loginWaiters.delete(msxId);
      const tok = parsed?.payload?.data?.token;
      w.resolve(typeof tok === "string" ? tok : null);
      return;
    }

    if (msxId != null && pending.has(msxId)) {
      const entry = pending.get(msxId);
      // Topic ownership is enforced by broker; also bind payload source here.
      if (!matchesResponse(topic, parsed, entry.deviceUuid)) {
        log(`ack DROP: msx=${msxId} topic uuid=${topicUuid} beklenen=${entry.deviceUuid} (sahte response?)`);
        return;
      }
      const { opId, timer } = entry;
      clearTimeout(timer);
      pending.delete(msxId);
      // Auth/token hatası → token cache'i temizle ki bir sonraki retry yeniden login yapsın.
      if (result !== "success" && /level|token|forbidden|unauthor/i.test(String(message))) {
        tokenCache.delete(entry.deviceUuid);
        dbg(`token invalidate uuid=${entry.deviceUuid}`);
      }
      const ackBody = {
        opId,
        msxId,
        result: result === "success" ? "success" : "fail",
        message: result === "success" ? "panel accepted command" : "panel rejected command",
      };
      const r = await convexPost("/ide-bridge/ack", ackBody).catch((e) => ({ ok: false, text: e.message }));
      log(`ack opId=${opId} result=${ackBody.result} → convex ${r.ok ? "OK" : "FAIL"}`);
    }
    return;
  }

  const event = boundEvent(topic, parsed, { legacy: legacyEvents });
  if (!event) { dbg("unbound MQTT event dropped"); return; }

  // Event topic normalized only after broker namespace / payload source binding.
  const type = event.topic;
  if (type === "event/heartbeat") dbg(`heartbeat ${parsed?.transaction?.["src-id"]}`);
  else log(`event ${topic} type=${type}`);

  const r = await convexPost("/ide-bridge/event", { topic: event.topic, body: raw }).catch((e) => ({ ok: false, text: e.message }));
  if (!r.ok) log(`event forward FAIL topic=${topic}: ${r.status}`);
}
