#!/usr/bin/env node
/**
 * IDE Smart Provision Agent — kullanıcının PC'sinde çalışan LOCAL köprü servisi.
 *
 * NEDEN: Panel LAN local IP'sinde (ör. 192.168.1.4). Convex cloud oraya ulaşamaz;
 * HTTPS admin sayfası da http://<lan-ip>'ye mixed-content yüzünden fetch atamaz.
 * Tarayıcılar http://127.0.0.1'i "potentially trustworthy" sayıp muaf tutar, bu yüzden
 * admin UI bu localhost köprüsüne istek atar, köprü de LAN'dan panele POST eder.
 *
 * GÜVENLİK: Yalnızca 127.0.0.1'e bind eder (dışarıdan erişilemez). L3 + broker device
 * şifresi burada (.env.local) kalır; admin UI yalnızca panel IP (+ opsiyonel L3 override)
 * gönderir. Convex'e hiçbir secret gitmez.
 *
 * Env (.env.local — `node --env-file=.env.local`):
 *   IDE_L3_USER, IDE_L3_PASS, IDE_PORT(80)
 *   MQTT_BROKER_HOST, MQTT_BROKER_PORT(8883), MQTT_DEVICE_USER(device), MQTT_DEVICE_PW
 *   IDE_AGENT_PORT(8765)
 *
 * Kullanım:
 *   npm run ide-agent
 *   # veya: node --env-file=.env.local scripts/ide-provision-agent.mjs
 */
import { createServer } from "node:http";
import { provisionPanel, readPanelMqttStatus } from "./lib/ide-provision.mjs";

const PORT = Number(process.env.IDE_AGENT_PORT || 8765);
const HOST = "127.0.0.1";

const ENV = {
  idePort: Number(process.env.IDE_PORT || 80),
  l3User: process.env.IDE_L3_USER || process.env.IDE_USER || "3",
  l3Pass: process.env.IDE_L3_PASS || process.env.IDE_PASS || "",
  broker: process.env.MQTT_BROKER_HOST || "",
  brokerPort: Number(process.env.MQTT_BROKER_PORT || 8883),
  mqttUser: process.env.MQTT_DEVICE_USER || "device",
  mqttPw: process.env.MQTT_DEVICE_PW || "",
};

const log = (...a) => console.log(`[ide-agent ${new Date().toISOString()}]`, ...a);

/** CORS + Private Network Access başlıkları (HTTPS admin → http://localhost için). */
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

function sendJson(res, status, body) {
  setCors(res);
  res.setHeader("Content-Type", "application/json");
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

/** Request body'sini JSON olarak okur (boşsa {}). */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 1_000_000) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function preflightOk() {
  if (!ENV.broker || !ENV.mqttPw || !ENV.l3Pass) {
    return "Eksik .env.local: MQTT_BROKER_HOST, MQTT_DEVICE_PW, IDE_L3_PASS gerekli.";
  }
  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    setCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    // GET /health — secret içermez
    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, {
        ok: true,
        broker: ENV.broker || null,
        brokerPort: ENV.brokerPort,
        configError: preflightOk(),
      });
      return;
    }

    // GET /panel-status?ip=... — reboot sonrası MQTT.STATUS doğrulama
    if (req.method === "GET" && path === "/panel-status") {
      const ip = url.searchParams.get("ip");
      if (!ip) return sendJson(res, 400, { ok: false, error: "ip parametresi gerekli" });
      const result = await readPanelMqttStatus({
        ip,
        port: ENV.idePort,
        l3User: ENV.l3User,
        l3Pass: ENV.l3Pass,
      });
      sendJson(res, 200, result);
      return;
    }

    // POST /provision — paneli broker'a al
    if (req.method === "POST" && path === "/provision") {
      const cfgErr = preflightOk();
      if (cfgErr) return sendJson(res, 500, { ok: false, error: cfgErr });

      const body = await readBody(req);
      const ip = typeof body.ip === "string" ? body.ip.trim() : "";
      if (!ip) return sendJson(res, 400, { ok: false, error: "ip gerekli" });

      log(`provision -> ${ip} (broker ${ENV.broker}:${ENV.brokerPort})`);
      const result = await provisionPanel({
        ip,
        port: typeof body.port === "number" ? body.port : ENV.idePort,
        l3User: typeof body.l3User === "string" && body.l3User ? body.l3User : ENV.l3User,
        l3Pass: typeof body.l3Pass === "string" && body.l3Pass ? body.l3Pass : ENV.l3Pass,
        broker: ENV.broker,
        brokerPort: ENV.brokerPort,
        mqttUser: ENV.mqttUser,
        mqttPw: ENV.mqttPw,
        ssl: body.ssl !== false,
        reboot: body.reboot !== false,
      });
      log(`provision OK -> uuid ${result.uuid}, ok=${result.ok}, rebooted=${result.rebooted}`);
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { ok: false, error: "not found" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR:", message);
    sendJson(res, 500, { ok: false, error: message });
  }
});

server.listen(PORT, HOST, () => {
  log(`listening on http://${HOST}:${PORT}`);
  log(`broker hedefi: ${ENV.broker || "(EKSIK!)"}:${ENV.brokerPort}`);
  const cfgErr = preflightOk();
  if (cfgErr) log("UYARI:", cfgErr);
});
