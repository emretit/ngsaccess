#!/usr/bin/env node
/**
 * IDE Smart panel TEŞHİS aracı (tek-seferlik, throwaway).
 *
 * Amaç: panelin GERÇEK durumunu OKU — kuyruk yazma-only olduğu için Convex'ten göremiyoruz.
 *   - AC.* parametreleri (özellikle AC.ACCESS_CACHE) → stale-cache şüphesi.
 *   - bir user kaydı (permissions[] gerçekte ne?) ve bir permission kaydı (schedule.week_days
 *     gerçekte ne? upsertPermission derlenmiş mi?).
 *
 * Broker loopback (127.0.0.1:1883) olduğu için bridge ile AYNI host'ta (Hetzner) çalıştır.
 * Bridge'in env dosyasını source et:  set -a; . /etc/ide-mqtt-bridge.env; set +a
 *
 * Çalıştırma (secret'lar env'den; koda gömme):
 *   PANEL_UUID=289833329732592 PANEL_USER=<user> PANEL_PW=<pw> \
 *   READ_USER_ID=1184921424 READ_PERM_ID=1 \
 *   node scripts/ide-panel-inspect.mjs
 *
 * Bu araç YALNIZCA okur (parameter_read / get_data). Hiçbir şey yazmaz/silmez.
 */
import mqtt from "mqtt";
import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";

const MQTT_URL = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const MQTT_USER = process.env.MQTT_BRIDGE_USER || "bridge";
const MQTT_PW = process.env.MQTT_BRIDGE_PW || "";
const MQTT_CA_FILE = process.env.MQTT_CA_FILE || "";

const PANEL_UUID = process.env.PANEL_UUID || "";
const PANEL_USER = process.env.PANEL_USER || "";
const PANEL_PW = process.env.PANEL_PW || "";
const READ_USER_ID = process.env.READ_USER_ID ? Number(process.env.READ_USER_ID) : null;
const READ_PERM_ID = process.env.READ_PERM_ID ? Number(process.env.READ_PERM_ID) : null;
const ACK_TIMEOUT_MS = Number(process.env.CMD_ACK_TIMEOUT_MS || 12000);
const AC_PARAMS = (process.env.AC_PARAMS ||
  "AC.ACCESS_CACHE,AC.RUN_WITHOUT_TIME,AC.ANTI_PASSBACK,AC.MAX_PERMS_PER_USER,REPO.AUTO_RESET_CACHE")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!PANEL_UUID || !PANEL_USER || !PANEL_PW) {
  console.error("HATA: PANEL_UUID, PANEL_USER, PANEL_PW zorunlu (env).");
  process.exit(1);
}

const log = (...a) => console.log(`[inspect ${new Date().toISOString()}]`, ...a);
const waiters = new Map(); // msxId → {resolve, timer}

function nextMsx() {
  for (let i = 0; i < 5; i++) {
    const c = randomInt(1, 2_000_000_000);
    if (!waiters.has(c)) return c;
  }
  return randomInt(1, 2_000_000_000);
}

const mqttOpts = {
  username: MQTT_USER,
  password: MQTT_PW,
  reconnectPeriod: 3000,
  keepalive: 30,
  clean: true,
  clientId: `ide-inspect-${process.pid}`,
};
if (MQTT_URL.startsWith("mqtts") && MQTT_CA_FILE) {
  mqttOpts.ca = readFileSync(MQTT_CA_FILE);
  mqttOpts.rejectUnauthorized = true;
}

const client = mqtt.connect(MQTT_URL, mqttOpts);
const RESP_TOPIC = `device/publish/${PANEL_UUID}`;

client.on("error", (e) => log("MQTT error:", e.message));

client.on("message", (topic, buf) => {
  if (topic !== RESP_TOPIC) return;
  let parsed = null;
  try {
    parsed = JSON.parse(buf.toString("utf8"));
  } catch {
    return;
  }
  const msxId = parsed?.transaction?.["msx-id"];
  if (msxId == null || !waiters.has(msxId)) return;
  const w = waiters.get(msxId);
  clearTimeout(w.timer);
  waiters.delete(msxId);
  w.resolve(parsed?.payload ?? null);
});

// Bir komut gönder, msx-id ile yanıtı bekle. payload döner.
function request(type, payload, token) {
  return new Promise((resolve) => {
    const msxId = nextMsx();
    const transaction = { "msx-id": msxId, "src-id": 1001, type, "dst-id": Number(PANEL_UUID) };
    if (token) transaction.token = token;
    const envelope = JSON.stringify({ transaction, payload });
    const timer = setTimeout(() => {
      waiters.delete(msxId);
      log(`TIMEOUT type=${type}`);
      resolve(null);
    }, ACK_TIMEOUT_MS);
    waiters.set(msxId, { resolve, timer });
    client.publish(`device/subscribe/${PANEL_UUID}`, envelope, { qos: 1 }, (err) => {
      if (err) {
        clearTimeout(timer);
        waiters.delete(msxId);
        log(`publish HATA type=${type}: ${err.message}`);
        resolve(null);
      }
    });
  });
}

async function main() {
  await new Promise((res) => client.once("connect", res));
  log(`MQTT bağlandı: ${MQTT_URL}`);
  await new Promise((res, rej) =>
    client.subscribe(RESP_TOPIC, { qos: 1 }, (e) => (e ? rej(e) : res())),
  );
  log(`subscribe OK: ${RESP_TOPIC}`);

  // 1) login → token
  const loginResp = await request("login", { user: PANEL_USER, password: PANEL_PW });
  const token = loginResp?.data?.token;
  if (typeof token !== "string") {
    log("LOGIN BAŞARISIZ:", JSON.stringify(loginResp));
    client.end();
    process.exit(2);
  }
  log(`login OK level=${token.split(".")[0]}`);

  // 2) AC parametreleri
  const paramResp = await request("parameter_read", { parameters: AC_PARAMS }, token);
  log("=== parameter_read ===");
  console.log(JSON.stringify(paramResp, null, 2));

  // 3) user kaydı
  if (READ_USER_ID != null) {
    const userResp = await request("get_data", { data_type: "user", data_id: READ_USER_ID }, token);
    log(`=== get_data user ${READ_USER_ID} ===`);
    console.log(JSON.stringify(userResp, null, 2));
  }

  // 4) permission kaydı
  if (READ_PERM_ID != null) {
    const permResp = await request("get_data", { data_type: "permission", data_id: READ_PERM_ID }, token);
    log(`=== get_data permission ${READ_PERM_ID} ===`);
    console.log(JSON.stringify(permResp, null, 2));
  }

  client.end();
  process.exit(0);
}

main().catch((e) => {
  log("HATA:", e?.message ?? String(e));
  client.end();
  process.exit(1);
});
