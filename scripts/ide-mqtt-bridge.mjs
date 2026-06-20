#!/usr/bin/env node
/**
 * IDE Smart MQTT Bridge — Hetzner'da 7/24 (systemd) çalışır.
 *
 * Konum: broker (Mosquitto, loopback 1883) ile Convex arasında köprü.
 *   - Panel olayları (event/#, device/publish/+) → Convex'e HTTPS POST.
 *   - Convex komut kuyruğu (/ide-bridge/poll) → device/subscribe/<uuid>'e MQTT publish.
 *   - Panel response'u (device/publish/<uuid>) → msx-id ile eşle → /ide-bridge/ack.
 *
 * Convex serverless kalıcı MQTT tutamaz; bu daemon o boşluğu doldurur (ide-smart-relay.mjs'in
 * MQTT eşdeğeri). msx-id correlation tamamen burada (Convex envelope üretmez, op spec'i döner).
 *
 * Env (/etc/ide-mqtt-bridge.env):
 *   MQTT_URL                 mqtt://127.0.0.1:1883   (loopback plaintext; TLS gerekirse mqtts://...)
 *   MQTT_BRIDGE_USER         bridge
 *   MQTT_BRIDGE_PW           <secret>
 *   MQTT_CA_FILE             /opt/ngs-mqtt/certs/ca.crt  (sadece mqtts:// için)
 *   CONVEX_SITE_URL          https://notable-tern-4.convex.site
 *   IDE_BRIDGE_SECRET        <Convex /ide-bridge/* Bearer secret>
 *   POLL_INTERVAL_MS         2000
 *   CMD_ACK_TIMEOUT_MS       12000
 *   BRIDGE_DEBUG             0|1
 */
import mqtt from "mqtt";
import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";

// ── Config ──────────────────────────────────────────────────────────
const MQTT_URL = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const MQTT_USER = process.env.MQTT_BRIDGE_USER || "bridge";
const MQTT_PW = process.env.MQTT_BRIDGE_PW || "";
const MQTT_CA_FILE = process.env.MQTT_CA_FILE || "";
const CONVEX_SITE_URL = (process.env.CONVEX_SITE_URL || "").replace(/\/+$/, "");
const BRIDGE_SECRET = process.env.IDE_BRIDGE_SECRET || "";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 2000);
// Adaptive backoff tavanı: bekleyen komut yokken poll aralığı her boş turda 2x büyür ve
// burada durur; komut çekilince anında tabana (POLL_INTERVAL_MS) döner. Boş /ide-bridge/poll
// çağrılarını (Convex function-call maliyeti) seyreltir. Idle'da ilk komut en fazla bu kadar
// gecikir; panel→Convex event akışı (kart okuma) MQTT push olduğundan bundan etkilenmez.
const POLL_MAX_INTERVAL_MS = Number(process.env.POLL_MAX_INTERVAL_MS || 30000);
const CMD_ACK_TIMEOUT_MS = Number(process.env.CMD_ACK_TIMEOUT_MS || 12000);
const DEBUG = process.env.BRIDGE_DEBUG === "1";

if (!CONVEX_SITE_URL || !BRIDGE_SECRET) {
  console.error("[bridge] HATA: CONVEX_SITE_URL ve IDE_BRIDGE_SECRET zorunlu.");
  process.exit(1);
}

const log = (...a) => console.log(`[bridge ${new Date().toISOString()}]`, ...a);
const dbg = (...a) => DEBUG && log("DEBUG", ...a);

// Bekleyen komutlar: msxId → { opId, deviceUuid, timer }
const pending = new Map();

// Bekleyen login'ler: msxId → { uuid, resolve, timer }
const loginWaiters = new Map();
// Panel token cache: uuid → { token, expMs }
const tokenCache = new Map();

// Level-1 yetki isteyen op'lar (create_data/update_data/delete_data/sync) — login token'ı ister.
// openDoor (update_actuator keep=1) level 0'dır, token'sız çalışır.
const LEVEL1_OPS = new Set([
  "upsertUser",
  "deleteUser",
  "upsertPermission",
  "deletePermission",
  "triggerSync",
  "parameterWrite",
]);

// token = level.iat.exp.uuid.sig (exp saniye). exp'ten ms döner; çözülemezse ~9dk.
function tokenExpMs(token) {
  const exp = Number(String(token).split(".")[2]);
  return Number.isSafeInteger(exp) ? exp * 1000 : Date.now() + 540_000;
}

// Panel için geçerli token döndür; cache'te yok/dolmuşsa MQTT login yapar (30s marj).
async function ensureToken(uuid, user, password) {
  const cached = tokenCache.get(uuid);
  if (cached && cached.expMs - 30_000 > Date.now()) return cached.token;
  if (!user || !password) {
    log(`token alınamadı: uuid=${uuid} için kimlik bilgisi yok (poll'da ideUser/idePassword eksik)`);
    return null;
  }
  const token = await loginOverMqtt(uuid, user, password);
  if (token) {
    tokenCache.set(uuid, { token, expMs: tokenExpMs(token) });
    dbg(`login OK uuid=${uuid} level=${String(token).split(".")[0]} exp=${new Date(tokenExpMs(token)).toISOString()}`);
  }
  return token;
}

// device/subscribe/<uuid>'e login envelope publish edip device/publish'ten token'ı bekler.
function loginOverMqtt(uuid, user, password) {
  return new Promise((resolve) => {
    const msxId = nextMsx();
    const envelope = JSON.stringify({
      transaction: { "msx-id": msxId, "src-id": 1001, type: "login", "dst-id": Number(uuid) },
      payload: { user, password },
    });
    const timer = setTimeout(() => {
      loginWaiters.delete(msxId);
      log(`login TIMEOUT uuid=${uuid}`);
      resolve(null);
    }, CMD_ACK_TIMEOUT_MS);
    loginWaiters.set(msxId, { uuid: String(uuid), resolve, timer });
    client.publish(`device/subscribe/${uuid}`, envelope, { qos: 1 }, (err) => {
      if (err) {
        clearTimeout(timer);
        loginWaiters.delete(msxId);
        log(`login publish HATA uuid=${uuid}: ${err.message}`);
        resolve(null);
      }
    });
  });
}

// ── msx-id üretimi (correlation anahtarı) ──────────────────────────
// TAHMİN EDİLEMEZ olmalı: paneller device/publish/# write yetkisini paylaştığından
// (ACL), tahmin edilebilir/dar bir sayaç bir panelin başka panele ait komutun
// msx-id'sini brute-force'layıp sahte ack publish etmesine zemin hazırlar. Geniş
// rastgele uzaydan + pending'de çakışma yoksa kullan (topic-uuid kontrolü ek savunma).
function nextMsx() {
  for (let i = 0; i < 5; i++) {
    const candidate = randomInt(1, 2_000_000_000);
    if (!pending.has(candidate)) return candidate;
  }
  return randomInt(1, 2_000_000_000);
}

// ── Convex HTTP yardımcıları ────────────────────────────────────────
async function convexPost(path, body) {
  const res = await fetch(`${CONVEX_SITE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BRIDGE_SECRET}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { status: res.status, ok: res.status >= 200 && res.status < 300, json, text };
}

// ── MQTT envelope (panelin beklediği SF formatı) ────────────────────
function buildEnvelope(type, payload, { dstId, token, msxId }) {
  const transaction = { "msx-id": msxId, "src-id": 1001, type };
  if (dstId !== undefined && dstId !== null) {
    const n = Number(dstId);
    transaction["dst-id"] = Number.isSafeInteger(n) ? n : dstId;
  }
  if (token) transaction.token = token;
  return JSON.stringify({ transaction, payload });
}

// op spec (Convex'ten gelen) → MQTT envelope. Panel komut tipleri.
function envelopeForOp(op, msxId, token) {
  const base = { dstId: op.dstId, token: token ?? op.token, msxId };
  switch (op.opType) {
    case "openDoor":
      return buildEnvelope("update_actuator", { io_id: op.ioId, keep: op.keep ?? 1 }, base);
    case "upsertUser":
      return buildEnvelope(op.mode === "update" ? "update_data" : "create_data", { data_type: "user", ...op.userRecord }, base);
    case "deleteUser":
      return buildEnvelope("delete_data", { data_type: "user", id: op.ideUserId }, base);
    case "upsertPermission":
      return buildEnvelope(op.mode === "update" ? "update_data" : "create_data", { data_type: "permission", ...op.permissionRecord }, base);
    case "deletePermission":
      return buildEnvelope("delete_data", { data_type: "permission", id: op.ideId }, base);
    case "triggerSync":
      return buildEnvelope(op.reset ? "sync_reset" : "sync", {}, base);
    case "parameterWrite":
      // parameterRecord = { "ACTUATOR0.REQUIRE_SENSOR_ACTIVATION": 0 } gibi düz key→değer.
      return buildEnvelope("parameter_write", { ...op.parameterRecord }, base);
    default:
      return null;
  }
}

// ── MQTT bağlantısı ─────────────────────────────────────────────────
const mqttOpts = {
  username: MQTT_USER,
  password: MQTT_PW,
  reconnectPeriod: 3000,
  keepalive: 30,
  clean: true,
  clientId: `ide-bridge-${process.pid}`,
};
if (MQTT_URL.startsWith("mqtts") && MQTT_CA_FILE) {
  mqttOpts.ca = readFileSync(MQTT_CA_FILE);
  mqttOpts.rejectUnauthorized = true;
}

const client = mqtt.connect(MQTT_URL, mqttOpts);

// Panel event topic'leri (LOGGER.* default'ları) + komut response wildcard.
const SUB_TOPICS = [
  "event/access/online",
  "event/access/offline",
  "event/heartbeat",
  "event/connected",
  "event/disconnected",
  "device/publish/+", // komut response'ları (msx-id correlation)
];

client.on("connect", () => {
  log(`MQTT bağlandı: ${MQTT_URL}`);
  client.subscribe(SUB_TOPICS, { qos: 1 }, (err, granted) => {
    if (err) log("subscribe HATA:", err.message);
    else log("subscribe OK:", granted.map((g) => g.topic).join(", "));
  });
});
client.on("reconnect", () => dbg("MQTT reconnect..."));
client.on("error", (e) => log("MQTT error:", e.message));
client.on("close", () => dbg("MQTT kapandı"));

// ── Gelen mesaj yönlendirme ─────────────────────────────────────────
client.on("message", async (topic, buf) => {
  const raw = buf.toString("utf8");
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* non-json — yine de forward edilebilir */
  }

  // Komut response'u mu? (device/publish/<uuid>, msx-id correlate)
  if (topic.startsWith("device/publish/")) {
    const msxId = parsed?.transaction?.["msx-id"];
    const result = parsed?.payload?.result;
    const message = parsed?.payload?.message ?? null;
    const topicUuid = topic.slice("device/publish/".length);
    dbg(`response topic=${topic} msx=${msxId} result=${result}`);

    // Login response mu? (type=login_response, token taşır) — loginWaiters ile eşle.
    if (msxId != null && loginWaiters.has(msxId)) {
      const w = loginWaiters.get(msxId);
      clearTimeout(w.timer);
      loginWaiters.delete(msxId);
      // Sahte response savunması: token komutun gönderildiği panelin topic'inden gelmeli.
      if (String(w.uuid) !== topicUuid) {
        log(`login response DROP: topic uuid=${topicUuid} beklenen=${w.uuid}`);
        w.resolve(null);
        return;
      }
      const tok = parsed?.payload?.data?.token;
      w.resolve(typeof tok === "string" ? tok : null);
      return;
    }

    if (msxId != null && pending.has(msxId)) {
      const entry = pending.get(msxId);
      // Response, komutun gönderildiği panelin KENDİ publish topic'inden gelmeli.
      // Paneller device/publish/# write yetkisini paylaştığından (ACL), başka bir
      // panel sahte ack publish edebilir → topic uuid ile beklenen uuid eşleşmezse drop.
      if (String(entry.deviceUuid) !== topicUuid) {
        log(`ack DROP: msx=${msxId} topic uuid=${topicUuid} beklenen=${entry.deviceUuid} (sahte response?)`);
        return;
      }
      const { opId, timer } = entry;
      clearTimeout(timer);
      pending.delete(msxId);
      // Auth/token hatası → token cache'i temizle ki bir sonraki retry yeniden login yapsın.
      if (result !== "success" && /level|token|forbidden|unauthor/i.test(String(message))) {
        tokenCache.delete(entry.deviceUuid);
        dbg(`token invalidate uuid=${entry.deviceUuid} (auth fail: ${String(message).slice(0, 60)})`);
      }
      const ackBody = {
        opId,
        msxId,
        result: result === "success" ? "success" : "fail",
        message: typeof message === "string" ? message : JSON.stringify(message),
      };
      const r = await convexPost("/ide-bridge/ack", ackBody).catch((e) => ({ ok: false, text: e.message }));
      log(`ack opId=${opId} result=${ackBody.result} → convex ${r.ok ? "OK" : "FAIL " + r.text}`);
    }
    return;
  }

  // Event (access/heartbeat/connected/disconnected) → Convex /ide-bridge/event
  const type = parsed?.transaction?.type ?? topic;
  if (type === "heartbeat") dbg(`heartbeat ${parsed?.transaction?.["src-id"]}`);
  else log(`event ${topic} type=${type}`);

  const r = await convexPost("/ide-bridge/event", { topic, body: raw }).catch((e) => ({ ok: false, text: e.message }));
  if (!r.ok) log(`event forward FAIL topic=${topic}: ${r.status} ${r.text?.slice(0, 120)}`);
});

// ── Komut poll döngüsü (Convex → broker) ────────────────────────────
let polling = false;
// Dönüş: bu turda komut çekildi mi (true → caller backoff'u tabana çeker).
async function pollCommands() {
  if (polling || !client.connected) return false;
  polling = true;
  try {
    const r = await convexPost("/ide-bridge/poll", { max: 10 });
    if (!r.ok) {
      dbg(`poll ${r.status}: ${r.text?.slice(0, 120)}`);
      return false;
    }
    const ops = Array.isArray(r.json?.ops) ? r.json.ops : [];
    for (const op of ops) {
      const msxId = nextMsx();
      // Level-1 op'lar (create_data/delete_data/sync) panelde login token'ı ister; yoksa
      // panel "forbidden: requires level 1, you are 0" döner. Token'ı MQTT login ile al/cache'le.
      let token;
      if (LEVEL1_OPS.has(op.opType)) {
        token = await ensureToken(op.dstId, op.ideUser, op.idePassword);
        if (!token) {
          log(`opId=${op.opId} type=${op.opType} → token alınamadı; op pending kalır, sonraki poll'da yeniden denenir`);
          continue; // markSent yapılmadı → op pending; bir sonraki poll login'i tekrar dener.
        }
      }
      const envelope = envelopeForOp(op, msxId, token);
      if (!envelope) {
        log(`bilinmeyen opType=${op.opType} opId=${op.opId} — atlanıyor`);
        await convexPost("/ide-bridge/ack", { opId: op.opId, msxId, result: "fail", message: "unknown opType" }).catch(() => {});
        continue;
      }
      const cmdTopic = `device/subscribe/${op.dstId}`;
      // ÖNCE Convex'e "sent" yaz (op'u pending→sent + msxId + attempts++). Bu başarısız
      // olursa PUBLISH ETME: op "pending" kalır, bir sonraki poll'da tekrar çekilir.
      // Aksi halde publish edip "sent" yazamazsak op "pending" kalır ve her poll'da
      // YENİDEN publish edilir (openDoor idempotent değil → kapı tekrar tekrar açılır).
      const sentRes = await convexPost("/ide-bridge/sent", { opId: op.opId, msxId }).catch(
        (e) => ({ ok: false, text: e.message }),
      );
      if (!sentRes.ok) {
        log(`opId=${op.opId} sent-mark FAIL (${sentRes.text ?? sentRes.status}) → publish atlandı, sonraki poll'da yeniden denenecek`);
        continue;
      }
      // Timeout: panel response'u gelmezse retry'a düşür.
      const timer = setTimeout(async () => {
        pending.delete(msxId);
        log(`opId=${op.opId} msx=${msxId} ACK TIMEOUT → retry`);
        await convexPost("/ide-bridge/ack", { opId: op.opId, msxId, result: "timeout", message: "no response" }).catch(() => {});
      }, CMD_ACK_TIMEOUT_MS);
      pending.set(msxId, { opId: op.opId, deviceUuid: op.dstId, timer });
      client.publish(cmdTopic, envelope, { qos: 1 }, (err) => {
        if (err) {
          // Publish broker'a gitmedi → timeout beklemeden hemen retry'a düşür.
          log(`publish HATA ${cmdTopic}: ${err.message} → hemen retry`);
          clearTimeout(timer);
          pending.delete(msxId);
          void convexPost("/ide-bridge/ack", { opId: op.opId, msxId, result: "fail", message: `publish error: ${err.message}` }).catch(() => {});
        } else {
          log(`komut publish opId=${op.opId} type=${op.opType} → ${cmdTopic} (msx=${msxId})`);
        }
      });
    }
    return ops.length > 0;
  } catch (e) {
    log("poll exception:", e.message);
    return false;
  } finally {
    polling = false;
  }
}

// Adaptive poll döngüsü: komut çekildiyse tabanda (hızlı) kal, boş turlarda kademeli yavaşla
// (POLL_INTERVAL_MS → 2x → ... → POLL_MAX_INTERVAL_MS). setInterval yerine recursive setTimeout
// kullanıyoruz ki aralık tura göre dinamik ayarlanabilsin.
// POLL_INTERVAL_MS<=0 → komut poll'ü tamamen kapalı: Convex /ide-bridge/poll +
// listPendingForBridge yükü sıfırlanır. Kart-event akışı (MQTT → /ide-bridge/event) devam
// eder, yani canlı izleme çalışır; sadece Convex→panel komutları (kapı aç, kişi sync) gitmez.
// Kota acil durumunda "kart okuma kalsın, poll dursun" için kullan.
let currentPollMs = POLL_INTERVAL_MS;
let pollTimer = null;
if (POLL_INTERVAL_MS > 0) {
  pollTimer = setTimeout(async function tick() {
    const handled = await pollCommands();
    currentPollMs = handled
      ? POLL_INTERVAL_MS
      : Math.min(currentPollMs * 2, POLL_MAX_INTERVAL_MS);
    pollTimer = setTimeout(tick, currentPollMs);
  }, POLL_INTERVAL_MS);
} else {
  log("komut poll DEVRE DIŞI (POLL_INTERVAL_MS<=0) — yalnız kart-event akışı aktif");
}

// ── Graceful shutdown ───────────────────────────────────────────────
function shutdown() {
  log("kapanıyor...");
  clearTimeout(pollTimer);
  for (const { timer } of pending.values()) clearTimeout(timer);
  client.end(true, () => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

log(`başladı. Convex=${CONVEX_SITE_URL} poll=${POLL_INTERVAL_MS}–${POLL_MAX_INTERVAL_MS}ms (adaptive) ackTimeout=${CMD_ACK_TIMEOUT_MS}ms`);
