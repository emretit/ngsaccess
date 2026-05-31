#!/usr/bin/env node
/**
 * IDE Smart paneli kendi Hetzner Mosquitto broker'ımıza alır (L3) ve MQTT moduna geçirir.
 *
 * NEDEN MQTT: docs §3.4 — update_actuator MQTT kanalında Level 0; heartbeat-response
 * (HTTP_REMOTE) kanalında Level 99 (kapalı). Kapı açma + tüm komutlar MQTT'de serbest.
 *
 * NE YAPAR (canlı doğrulanmış seviyeler):
 *  - MQTT.BROKER/PORT/USERNAME/PASSWORD/SSL_* yaz (L3).
 *  - MQTT.TOPIC_AUTO_SET=0 + explicit TOPIC_SUBSCRIBE/PUBLISH (bridge ile uyumlu, <uuid> türetilir).
 *  - LOGGER.PROTOCOL=MQTT + event topic'leri (default'lar; ACL ile uyumlu).
 *  - reboot (LOGGER/MQTT boot'ta okunur — set-http-target deneyiminden) → MQTT modu aktifleşir.
 *
 * Panel SSL_SELF_SIGNED=1 → broker self-signed CA sertifikasını kabul eder (gen-certs.sh).
 *
 * Env (.env.local — `node --env-file=.env.local`):
 *   IDE_IP, IDE_PORT(80), IDE_L3_USER, IDE_L3_PASS
 *   MQTT_BROKER_HOST, MQTT_BROKER_PORT(8883), MQTT_DEVICE_USER, MQTT_DEVICE_PW
 * Args (env):
 *   NO_REBOOT=1  → reboot etme (manuel)
 *   REVERT=1     → HTTP moduna geri al (set-http-target.mjs çağırması önerilir; burada uyarı verir)
 *
 * Kullanım:
 *   node --env-file=.env.local scripts/ide-smart-set-mqtt-target.mjs
 */
const IP = process.env.IDE_IP;
const PORT = Number(process.env.IDE_PORT || 80);
const USER = process.env.IDE_L3_USER || process.env.IDE_USER;
const PASS = process.env.IDE_L3_PASS || process.env.IDE_PASS;

const BROKER = process.env.MQTT_BROKER_HOST;
const BROKER_PORT = Number(process.env.MQTT_BROKER_PORT || 8883);
const MQTT_USER = process.env.MQTT_DEVICE_USER || "device";
const MQTT_PW = process.env.MQTT_DEVICE_PW;
const NO_REBOOT = process.env.NO_REBOOT === "1";
const REVERT = process.env.REVERT === "1";

if (REVERT) {
  console.error("REVERT için: node --env-file=.env.local scripts/ide-smart-set-http-target.mjs (TARGET_HOST veya REVERT=1).");
  process.exit(1);
}
if (!IP || !PASS) {
  console.error("HATA: IDE_IP ve IDE_L3_PASS gerekli (.env.local).");
  process.exit(1);
}
if (!BROKER || !MQTT_PW) {
  console.error("HATA: MQTT_BROKER_HOST ve MQTT_DEVICE_PW gerekli (.env.local).");
  process.exit(1);
}

let msx = 1;
const url = `http://${IP}:${PORT}/`;
function envelope(type, payload, { token, dstId } = {}) {
  const transaction = { "msx-id": msx++, "src-id": 1001, type };
  if (dstId !== undefined) transaction["dst-id"] = Number(dstId);
  if (token) transaction.token = token;
  return JSON.stringify({ transaction, payload });
}
async function call(body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return JSON.parse(await res.text()).payload;
}

const main = async () => {
  const lr = await call(envelope("login", { user: USER, password: PASS }));
  if (lr.result !== "success") {
    console.log("Login FAIL:", JSON.stringify(lr));
    process.exit(2);
  }
  const token = lr.data.token;
  const dst = Number(token.split(".")[3]);
  const uuid = String(dst);
  console.log(`Login OK (level ${token.split(".")[0]}), UUID ${dst}`);

  // 1) MQTT broker bağlantısı (L3)
  const w1 = await call(
    envelope(
      "parameter_write",
      {
        "MQTT.BROKER": BROKER,
        "MQTT.PORT": BROKER_PORT,
        "MQTT.USERNAME": MQTT_USER,
        "MQTT.PASSWORD": MQTT_PW,
        "MQTT.SSL_ENABLED": 1,
        "MQTT.SSL_SELF_SIGNED": 1, // bizim self-signed CA'mız
        "MQTT.CLIENT_ID": `ngs-${uuid}`,
        // Topic'ler explicit (AUTO_SET kapalı) — bridge `device/subscribe/<uuid>` bekliyor.
        "MQTT.TOPIC_AUTO_SET": 0,
        "MQTT.TOPIC_SUBSCRIBE": `device/subscribe/${uuid}`,
        "MQTT.TOPIC_PUBLISH": `device/publish/${uuid}`,
      },
      { token, dstId: dst },
    ),
  );
  console.log("MQTT.* ->", w1.result, JSON.stringify(w1.message));

  // 2) LOGGER transport=MQTT + event topic'leri (ACL ile uyumlu default'lar)
  const w2 = await call(
    envelope(
      "parameter_write",
      {
        "LOGGER.PROTOCOL": "MQTT",
        "LOGGER.AC_LOG_TOPIC": "event/access/online",
        "LOGGER.AC_OFFLINE_LOG_TOPIC": "event/access/offline",
        "LOGGER.HB_TOPIC": "event/heartbeat",
        "LOGGER.HB_ENABLED": 1,
        "LOGGER.HB_INTERVAL": 30,
        "LOGGER.CONNECTED_TOPIC": "event/connected",
        "LOGGER.DISCONNECTED_TOPIC": "event/disconnected",
        "LOGGER.PUSH_ENABLED": 1,
        // HTTP_REMOTE komut kanalını kapat (artık MQTT kullanıyoruz).
        "LOGGER.HB_PROCESS_RESPONSE": 0,
      },
      { token, dstId: dst },
    ),
  );
  console.log("LOGGER.* ->", w2.result, JSON.stringify(w2.message));

  // 3) Read-back doğrulama
  const rb = await call(
    envelope(
      "parameter_read",
      {
        parameters: [
          "MQTT.BROKER",
          "MQTT.PORT",
          "MQTT.USERNAME",
          "MQTT.SSL_ENABLED",
          "MQTT.SSL_SELF_SIGNED",
          "MQTT.TOPIC_SUBSCRIBE",
          "MQTT.TOPIC_PUBLISH",
          "MQTT.STATUS",
          "LOGGER.PROTOCOL",
          "LOGGER.AC_LOG_TOPIC",
          "LOGGER.HB_ENABLED",
        ],
      },
      { token, dstId: dst },
    ),
  );
  console.log("GÜNCEL:", JSON.stringify(rb.data, null, 2));

  // 4) reboot (LOGGER.PROTOCOL/MQTT boot'ta okunur — set-http-target deneyimi)
  if (!NO_REBOOT) {
    const rbt = await call(envelope("reboot", {}, { token, dstId: dst }));
    console.log("reboot ->", rbt.result, JSON.stringify(rbt.message));
    console.log("Panel ~30-60sn sonra MQTT modunda broker'a bağlanacak.");
  } else {
    console.log("NO_REBOOT=1 — değişiklik aktifleşmesi için paneli MANUEL reboot et.");
  }
  console.log(`\nHedef broker: ${BROKER}:${BROKER_PORT} (TLS self-signed). Bridge device/subscribe/${uuid} dinleyecek.`);
};
main();
