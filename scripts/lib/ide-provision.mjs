/**
 * IDE Smart panel provisioning — saf (env'siz) mantık.
 *
 * Hem CLI (scripts/ide-smart-set-mqtt-target.mjs) hem local köprü
 * (scripts/ide-provision-agent.mjs) bu fonksiyonları kullanır. Tek kaynak.
 *
 * Panel HTTP üzerinden JSON mesaj alır: login → parameter_write → parameter_read → reboot.
 * MQTT.* yazmak Level 3 ister (docs/ide-smart/03-authentication-authorization.md §3.3).
 * MQTT modu reboot'ta aktifleşir (LOGGER/MQTT boot'ta okunur).
 */

/** Panel envelope'u (msx-id artan sayaç caller'da tutulur). */
function makeEnvelope(msx, type, payload, { token, dstId } = {}) {
  const transaction = { "msx-id": msx, "src-id": 1001, type };
  if (dstId !== undefined) transaction["dst-id"] = Number(dstId);
  if (token) transaction.token = token;
  return JSON.stringify({ transaction, payload });
}

/** Panele POST atar, payload'ı döner. Hata durumunda anlamlı throw eder. */
async function callPanel(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Panel JSON döndürmedi (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  return parsed.payload;
}

/** L3 login → token + UUID döner. */
async function login(url, nextMsx, user, password) {
  const lr = await callPanel(url, makeEnvelope(nextMsx(), "login", { user, password }));
  if (!lr || lr.result !== "success" || !lr.data?.token) {
    throw new Error(`Login başarısız: ${JSON.stringify(lr)}`);
  }
  const token = lr.data.token;
  const parts = token.split(".");
  const level = parts[0];
  const dst = Number(parts[3]);
  return { token, level, dst, uuid: String(dst) };
}

/**
 * Paneli verilen broker'a alır ve MQTT moduna geçirir.
 * @returns {{ ok: boolean, uuid: string, level: string, writes: { mqtt: unknown, logger: unknown }, readback: Record<string, unknown>, rebooted: boolean }}
 */
export async function provisionPanel({
  ip,
  port = 80,
  l3User,
  l3Pass,
  broker,
  brokerPort = 8883,
  mqttUser = "device",
  mqttPw,
  ssl = true,
  selfSigned = true,
  reboot = true,
}) {
  if (!ip) throw new Error("ip zorunlu");
  if (!l3Pass) throw new Error("l3Pass zorunlu");
  if (!broker) throw new Error("broker zorunlu");
  if (!mqttPw) throw new Error("mqttPw zorunlu");

  const url = `http://${ip}:${port}/`;
  let msx = 1;
  const nextMsx = () => msx++;

  const { token, level, dst, uuid } = await login(url, nextMsx, l3User, l3Pass);

  // 1) MQTT broker bağlantısı (L3)
  const w1 = await callPanel(
    url,
    makeEnvelope(
      nextMsx(),
      "parameter_write",
      {
        "MQTT.BROKER": broker,
        "MQTT.PORT": Number(brokerPort),
        "MQTT.USERNAME": mqttUser,
        "MQTT.PASSWORD": mqttPw,
        "MQTT.SSL_ENABLED": ssl ? 1 : 0,
        "MQTT.SSL_SELF_SIGNED": selfSigned ? 1 : 0,
        "MQTT.CLIENT_ID": `ngs-${uuid}`,
        // Topic'ler explicit (AUTO_SET kapalı) — bridge `device/subscribe/<uuid>` bekliyor.
        "MQTT.TOPIC_AUTO_SET": 0,
        "MQTT.TOPIC_SUBSCRIBE": `device/subscribe/${uuid}`,
        "MQTT.TOPIC_PUBLISH": `device/publish/${uuid}`,
      },
      { token, dstId: dst },
    ),
  );

  // 2) LOGGER transport=MQTT + event topic'leri (ACL ile uyumlu default'lar)
  const w2 = await callPanel(
    url,
    makeEnvelope(
      nextMsx(),
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

  // 3) Read-back doğrulama
  const rb = await callPanel(
    url,
    makeEnvelope(
      nextMsx(),
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

  // 4) reboot (LOGGER.PROTOCOL/MQTT boot'ta okunur)
  let rebooted = false;
  if (reboot) {
    const rbt = await callPanel(url, makeEnvelope(nextMsx(), "reboot", {}, { token, dstId: dst }));
    rebooted = rbt?.result === "success";
  }

  return {
    ok: w1?.result === "success" && w2?.result === "success",
    uuid,
    level,
    writes: { mqtt: w1, logger: w2 },
    readback: rb?.data ?? {},
    rebooted,
  };
}

/**
 * Panelin mevcut MQTT durumunu okur (reboot sonrası bağlantı doğrulama).
 * @returns {{ ok: boolean, uuid: string, readback: Record<string, unknown> }}
 */
export async function readPanelMqttStatus({ ip, port = 80, l3User, l3Pass }) {
  if (!ip) throw new Error("ip zorunlu");
  if (!l3Pass) throw new Error("l3Pass zorunlu");

  const url = `http://${ip}:${port}/`;
  let msx = 1;
  const nextMsx = () => msx++;

  const { token, dst, uuid } = await login(url, nextMsx, l3User, l3Pass);

  const rb = await callPanel(
    url,
    makeEnvelope(
      nextMsx(),
      "parameter_read",
      {
        parameters: ["MQTT.BROKER", "MQTT.PORT", "MQTT.STATUS", "LOGGER.PROTOCOL", "LOGGER.HB_ENABLED"],
      },
      { token, dstId: dst },
    ),
  );

  return { ok: true, uuid, readback: rb?.data ?? {} };
}
