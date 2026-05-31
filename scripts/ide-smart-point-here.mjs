#!/usr/bin/env node
/**
 * ⚠️ DEPRECATED — BUNU KULLANMA. Yerine: scripts/ide-smart-set-http-target.mjs
 *
 * Bu script "HTTPCLIENT.HOST" yazar; GERÇEK firmware'de o alias L99 ister ve REDDEDİLİR
 * (canlı doğrulandı 2026-05-29). Yazılabilir gerçek modül "HTTPC.*". Ayrıca LOGGER.* L2
 * ister (admin L1 değil L3 ile). Doğru, çalışan akış set-http-target.mjs'de (HTTPC.* + L3 +
 * read-back + REVERT). Bu dosya yalnızca tarihsel referans için bırakıldı.
 *
 * (eski açıklama) Panelin event hedefini verilen host:port'a çevirmeyi dener.
 */

const IP = process.env.IDE_IP || "192.168.1.4";
const PORT = Number(process.env.IDE_PORT || 80);
const USER = process.env.IDE_USER || "admin";
const PASS = process.env.IDE_PASS;
const TARGET_HOST = process.env.TARGET_HOST;
const TARGET_PORT = Number(process.env.TARGET_PORT || 8090);
const TARGET_PATH = process.env.TARGET_PATH || "/card-reader";

if (!PASS || !TARGET_HOST) {
  console.error("HATA: IDE_PASS ve TARGET_HOST zorunlu.");
  process.exit(1);
}

const SRC_ID = 1001;
let msx = 1;
const url = `http://${IP}:${PORT}/`;

function envelope(type, payload, { token, dstId } = {}) {
  const transaction = { "msx-id": msx++, "src-id": SRC_ID, type };
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
  return res.text();
}

(async () => {
  const loginRaw = await call(
    envelope("login", { user: USER, password: PASS }),
  );
  const token = JSON.parse(loginRaw)?.payload?.data?.token;
  if (!token) {
    console.log("✖ Login fail:", loginRaw);
    process.exit(2);
  }
  const dst = Number(token.split(".")[3]);
  console.log("✓ Login OK, UUID:", dst);

  // HTTPCLIENT (level 1) — event hedefi host/port
  const w1 = await call(
    envelope(
      "parameter_write",
      { "HTTPCLIENT.HOST": TARGET_HOST, "HTTPCLIENT.PORT": TARGET_PORT },
      { token, dstId: dst },
    ),
  );
  console.log("\nHTTPCLIENT.HOST/PORT yazma:\n ", w1);

  // LOGGER (level 3 gerekebilir) — protokol HTTP + access log path + heartbeat aç
  const w2 = await call(
    envelope(
      "parameter_write",
      {
        "LOGGER.PROTOCOL": "HTTP",
        "LOGGER.AC_LOG_PATH": TARGET_PATH,
        "LOGGER.HB_ENABLED": 1,
        "LOGGER.HB_INTERVAL": 15,
      },
      { token, dstId: dst },
    ),
  );
  console.log("\nLOGGER yazma (level 3 gerekebilir):\n ", w2);

  console.log(
    `\n→ Hedef: http://${TARGET_HOST}:${TARGET_PORT}${TARGET_PATH}\n` +
      "Yakalayıcıyı çalıştır (node scripts/ide-smart-capture.mjs) ve okuyucuya kart okut.",
  );
})();
