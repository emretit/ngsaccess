#!/usr/bin/env node
/**
 * IDE Smart paneli kendi Hetzner Mosquitto broker'ımıza alır (L3) ve MQTT moduna geçirir.
 *
 * NEDEN MQTT: docs §3.4 — update_actuator MQTT kanalında Level 0; heartbeat-response
 * (HTTP_REMOTE) kanalında Level 99 (kapalı). Kapı açma + tüm komutlar MQTT'de serbest.
 *
 * NE YAPAR: scripts/lib/ide-provision.mjs `provisionPanel` (login L3 → MQTT.*/LOGGER.*
 * parameter_write → read-back → reboot). Bu CLI sadece env'i okuyup o fonksiyonu çağırır;
 * aynı mantık local köprü servisinde (ide-provision-agent.mjs) de kullanılır.
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
import { provisionPanel } from "./lib/ide-provision.mjs";

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

const main = async () => {
  let result;
  try {
    result = await provisionPanel({
      ip: IP,
      port: PORT,
      l3User: USER,
      l3Pass: PASS,
      broker: BROKER,
      brokerPort: BROKER_PORT,
      mqttUser: MQTT_USER,
      mqttPw: MQTT_PW,
      reboot: !NO_REBOOT,
    });
  } catch (err) {
    console.error("Provision FAIL:", err instanceof Error ? err.message : String(err));
    process.exit(2);
  }

  console.log(`Login OK (level ${result.level}), UUID ${result.uuid}`);
  console.log("MQTT.* ->", result.writes.mqtt?.result, JSON.stringify(result.writes.mqtt?.message));
  console.log("LOGGER.* ->", result.writes.logger?.result, JSON.stringify(result.writes.logger?.message));
  console.log("GÜNCEL:", JSON.stringify(result.readback, null, 2));
  if (NO_REBOOT) {
    console.log("NO_REBOOT=1 — değişiklik aktifleşmesi için paneli MANUEL reboot et.");
  } else {
    console.log("reboot ->", result.rebooted ? "success" : "?");
    console.log("Panel ~30-60sn sonra MQTT modunda broker'a bağlanacak.");
  }
  console.log(`\nHedef broker: ${BROKER}:${BROKER_PORT} (TLS self-signed). Bridge device/subscribe/${result.uuid} dinleyecek.`);
};
main();
