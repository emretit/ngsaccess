#!/usr/bin/env node
/**
 * ADIM 0 — Heartbeat-Response komut enjeksiyonu CANLI DOĞRULAMA (broker'sız komut kanalı).
 *
 * Plan: docs/ide-smart heartbeat-response yolu (LOGGER.HB_PROCESS_RESPONSE).
 * Bu script, kod yazmadan önce 4 açık soruyu canlı panelde yanıtlar:
 *   1) HB_PROCESS_RESPONSE yazılabilir mi, hangi seviyede?
 *   2) Panel heartbeat cevabındaki Shape 3 (commands[]) update_actuator'ı çalıştırıyor mu? (kapı açılır mı)
 *   3) Komut token istiyor mu? (önce token'sız dener; çalışmazsa --with-token ile token gömer)
 *   4) HB_RESPONSE_PATH'e sonuç POST'u geliyor mu, msx-id echo'lanıyor mu?
 *
 * NASIL ÇALIŞIR:
 *   - Panele L3 login → HB_PROCESS_RESPONSE=1, HB_RESPONSE_PATH=<path>, HTTPC.HOST=<bu makine>,
 *     LOGGER.PROTOCOL=HTTP, HB_ENABLED=1, HB_INTERVAL kısa ayarlanır.
 *   - Lokal HTTP listener (PORT) panelin heartbeat POST'unu alır; İLK heartbeat'e Shape 3
 *     update_actuator(keep:1) cevabı döner. Sonraki heartbeat'lere {} (boş komut) döner.
 *   - HB_RESPONSE_PATH'e gelen sonuç POST'u loglanır (msx-id correlation gözlemi).
 *   - Bittiğinde REVERT ile HB_PROCESS_RESPONSE=0'a geri alınır (Ctrl-C ile de revert dener).
 *
 * Env (.env.local — manuel export ya da `node --env-file=.env.local`):
 *   IDE_IP, IDE_PORT(80), IDE_L3_USER, IDE_L3_PASS
 * Args (env):
 *   SELF_HOST   (zorunlu)  bu makinenin panelden görünen LAN IP'si (örn 192.168.1.245)
 *   PORT        (8090)     lokal listener portu
 *   OPEN_IO     (0)        test edilecek aktüatör io_id
 *   HB_INTERVAL (5)        heartbeat saniye (kısa = hızlı test)
 *   WITH_TOKEN  (0)        1 ise gömülen komuta panel token'ı eklenir (soru 3)
 *   RESP_PATH   (/ide-command-result)  HB_RESPONSE_PATH
 *   NO_REVERT   (0)        1 ise sonda HB_PROCESS_RESPONSE'u 0'a çekme
 *
 * Kullanım:
 *   node --env-file=.env.local scripts/ide-smart-probe-hb.mjs   # SELF_HOST=192.168.1.245 ... export'lu
 */
import http from "node:http";

const IP = process.env.IDE_IP;
const PORT_PANEL = Number(process.env.IDE_PORT || 80);
const USER = process.env.IDE_L3_USER || process.env.IDE_USER;
const PASS = process.env.IDE_L3_PASS || process.env.IDE_PASS;

const SELF_HOST = process.env.SELF_HOST;
const LISTEN_PORT = Number(process.env.PORT || 8090);
const OPEN_IO = Number(process.env.OPEN_IO || 0);
const HB_INTERVAL = Number(process.env.HB_INTERVAL || 5);
const WITH_TOKEN = process.env.WITH_TOKEN === "1";
const RESP_PATH = process.env.RESP_PATH || "/ide-command-result";
const NO_REVERT = process.env.NO_REVERT === "1";
// HB_PROCESS_RESPONSE muhtemelen boot-time okunuyor (SESSION: LOGGER.PROTOCOL boot'ta okunuyordu).
// REBOOT=1 → parametre yazımından sonra paneli reboot et, geri gelmesini bekle.
const REBOOT = process.env.REBOOT === "1";

if (!IP || !PASS) {
  console.error("HATA: IDE_IP ve IDE_L3_PASS gerekli (.env.local). `node --env-file=.env.local ...` kullan.");
  process.exit(1);
}
if (!SELF_HOST) {
  console.error("HATA: SELF_HOST zorunlu — panelin bu makineye ulaşacağı LAN IP (örn SELF_HOST=192.168.1.245).");
  process.exit(1);
}

let msx = 1;
const panelUrl = `http://${IP}:${PORT_PANEL}/`;

function envelope(type, payload, { token, dstId } = {}) {
  const transaction = { "msx-id": msx++, "src-id": 1001, type };
  if (dstId !== undefined) transaction["dst-id"] = Number(dstId);
  if (token) transaction.token = token;
  return JSON.stringify({ transaction, payload });
}

async function callPanel(body) {
  const res = await fetch(panelUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const text = await res.text();
  try {
    return JSON.parse(text).payload;
  } catch {
    return { result: "fail", message: `non-json: ${text.slice(0, 200)}` };
  }
}

// ── Panel state (login + token cache) ───────────────────────────────
let panelToken = null;
let panelDst = null;

async function loginPanel() {
  const lr = await callPanel(envelope("login", { user: USER, password: PASS }));
  if (lr.result !== "success") {
    console.error("[hb-probe] Login FAIL:", JSON.stringify(lr));
    process.exit(2);
  }
  panelToken = lr.data.token;
  panelDst = Number(panelToken.split(".")[3]);
  const level = panelToken.split(".")[0];
  console.log(`[hb-probe] Login OK (level ${level}), UUID ${panelDst}`);
}

async function writeParams(params) {
  const r = await callPanel(envelope("parameter_write", params, { token: panelToken, dstId: panelDst }));
  return r;
}

async function readParams(parameters) {
  const r = await callPanel(envelope("parameter_read", { parameters }, { token: panelToken, dstId: panelDst }));
  return r;
}

// ── Heartbeat'lere gömülecek komut ─────────────────────────────────
// MODE=actuator : her heartbeat farklı Shape (1→2→3) update_actuator
// MODE=ops      : HTTP_REMOTE kanalında HANGİ op'lar geçiyor? Sırayla farklı op tipleri.
//                 (kapı açma L99 kilitli; kişi/yetki/param yazma geçiyor mu?)
const MODE = process.env.MODE || "actuator";
let hbCount = 0;
let injectedMsx = null;
let lastOpLabel = "";

function tx(type) {
  const t = { "msx-id": msx++, "src-id": 1001, type, "dst-id": panelDst };
  if (WITH_TOKEN && panelToken) t.token = panelToken;
  injectedMsx = t["msx-id"];
  return t;
}

// HTTP_REMOTE kanalında test edilecek op'lar (zararsız/geri-alınabilir seçildi).
function opForIndex(i) {
  switch (i) {
    case 1:
      lastOpLabel = "parameter_read (SYSTEM.UUID) — kanal genel çalışıyor mu";
      return { transaction: tx("parameter_read"), payload: { parameters: ["SYSTEM.UUID"] } };
    case 2:
      lastOpLabel = "create_data user (KİŞİ yazma — asıl hedef)";
      return {
        transaction: tx("create_data"),
        payload: { data_type: "user", id: 999000111, status: 1, permissions: [] },
      };
    case 3:
      lastOpLabel = "create_data permission (YETKİ yazma — asıl hedef)";
      return {
        transaction: tx("create_data"),
        payload: {
          data_type: "permission",
          id: 9001,
          io: [0],
          schedule: { start: 0, end: 1439, week_days: [0, 1, 2, 3, 4, 5, 6] },
        },
      };
    case 4:
      lastOpLabel = "parameter_write (LOGGER.HB_INTERVAL) — config yazma geçiyor mu";
      return { transaction: tx("parameter_write"), payload: { "LOGGER.HB_INTERVAL": HB_INTERVAL } };
    case 5:
      lastOpLabel = "delete_data user (cleanup — test kullanıcısını sil)";
      return { transaction: tx("delete_data"), payload: { data_type: "user", id: 999000111 } };
    default:
      return null;
  }
}

function makeActuator() {
  lastOpLabel = "update_actuator (kapı aç — L99 bekleniyor)";
  return { transaction: tx("update_actuator"), payload: { io_id: OPEN_IO, keep: 1 } };
}

// shape: 1=raw, 2={command}, 3={commands:[]}
function wrap(cmd, shape) {
  if (shape === 1) return JSON.stringify(cmd);
  if (shape === 2) return JSON.stringify({ command: cmd });
  return JSON.stringify({ commands: [cmd] });
}

function buildCommandResponse(n) {
  if (MODE === "ops") {
    const cmd = opForIndex(n);
    if (!cmd) return null;
    return wrap(cmd, 3); // ops modunda Shape 3 sabit (zaten 3'ü de kabul ediliyor)
  }
  // actuator modu: n=shape (1→2→3)
  return wrap(makeActuator(), n);
}

// ── Lokal listener: heartbeat + HB_RESPONSE_PATH ────────────────────
function startListener() {
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const ts = new Date().toISOString();
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        /* non-json */
      }
      const type = parsed?.transaction?.type ?? "?";
      const path = req.url || "/";

      // HB_RESPONSE_PATH'e gelen komut sonucu (soru 4)
      if (path === RESP_PATH) {
        console.log(`\n[hb-probe] ★ HB_RESPONSE_PATH POST geldi (${path}):`);
        console.log("           " + raw.slice(0, 600));
        const echoedMsx = parsed?.transaction?.["msx-id"];
        console.log(
          `           → echoed msx-id=${echoedMsx} (gömülen=${injectedMsx}) ` +
            `${echoedMsx === injectedMsx ? "✓ EŞLEŞTI (correlation OK)" : "✗ eşleşmedi"}`,
        );
        const result = parsed?.payload?.result;
        console.log(`           → komut result=${JSON.stringify(result)} message=${JSON.stringify(parsed?.payload?.message)}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ payload: { result: "success", message: "ack received" } }));
        return;
      }

      // Heartbeat (LOGGER.HB_PATH) — her birine SIRAYLA komut göm.
      // actuator modu: 3 shape; ops modu: 5 op tipi (HTTP_REMOTE kanal yetki haritası).
      if (type === "heartbeat") {
        hbCount++;
        const maxN = MODE === "ops" ? 5 : 3;
        if (hbCount <= maxN) {
          const body = buildCommandResponse(hbCount);
          if (body) {
            console.log(
              `\n[hb-probe] heartbeat #${hbCount} → KOMUT (token=${WITH_TOKEN ? "var" : "yok"}, msx=${injectedMsx}): ${lastOpLabel}`,
            );
            console.log("           cevap body: " + body);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(body);
            return;
          }
        }
        console.log(`[${ts}] heartbeat #${hbCount} (${maxN} komut denendi, boş cevap)`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ payload: { result: "success" } }));
        return;
      }

      // Diğer (access_event vb.)
      console.log(`[${ts}] ${type}: ${raw.slice(0, 300)}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ payload: { result: "success" } }));
    });
  });
  server.listen(LISTEN_PORT, "0.0.0.0", () => {
    console.log(`[hb-probe] Listener http://0.0.0.0:${LISTEN_PORT}/  (heartbeat + ${RESP_PATH})`);
  });
  return server;
}

async function revertHbProcess() {
  try {
    await loginPanel(); // token expired olabilir, taze al
    const r = await writeParams({ "LOGGER.HB_PROCESS_RESPONSE": 0 });
    console.log("[hb-probe] REVERT HB_PROCESS_RESPONSE=0 ->", r.result, JSON.stringify(r.message));
  } catch (e) {
    console.warn("[hb-probe] revert hatası:", e.message);
  }
}

const main = async () => {
  await loginPanel();

  // Soru 1: HB_PROCESS_RESPONSE + path yazılabilir mi?
  console.log("\n[hb-probe] === SORU 1: HB_PROCESS_RESPONSE yazımı ===");
  const w = await writeParams({
    "HTTPC.HOST": SELF_HOST,
    "HTTPC.PORT": LISTEN_PORT,
    "LOGGER.PROTOCOL": "HTTP",
    "LOGGER.HB_ENABLED": 1,
    "LOGGER.HB_INTERVAL": HB_INTERVAL,
    "LOGGER.HB_PATH": "/", // heartbeat root'a gelsin (listener type'a göre ayırır)
    "LOGGER.HB_PROCESS_RESPONSE": 1,
    "LOGGER.HB_RESPONSE_PATH": RESP_PATH,
    "LOGGER.AC_LOG_PATH": "/", // access_event de buraya gelsin (gözlem)
  });
  console.log("[hb-probe] parameter_write ->", w.result, JSON.stringify(w.message));

  // Read-back: gerçekten yazıldı mı + hangi key'ler reddedildi (seviye tespiti)
  const rb = await readParams([
    "LOGGER.HB_PROCESS_RESPONSE",
    "LOGGER.HB_RESPONSE_PATH",
    "LOGGER.HB_ENABLED",
    "LOGGER.HB_INTERVAL",
    "LOGGER.HB_PATH",
    "LOGGER.PROTOCOL",
    "HTTPC.HOST",
    "HTTPC.PORT",
  ]);
  console.log("[hb-probe] read-back:", JSON.stringify(rb.data));
  console.log(
    `[hb-probe] → HB_PROCESS_RESPONSE yazıldı mı: ${rb.data?.["LOGGER.HB_PROCESS_RESPONSE"] === 1 ? "✓ EVET" : "✗ HAYIR / okunamadı"}`,
  );

  // HB_PROCESS_RESPONSE boot-time olabilir → reboot et (REBOOT=1).
  if (REBOOT) {
    console.log("\n[hb-probe] === REBOOT (HB_PROCESS_RESPONSE boot'ta aktifleşsin) ===");
    const rb2 = await callPanel(envelope("reboot", {}, { token: panelToken, dstId: panelDst }));
    console.log("[hb-probe] reboot ->", rb2.result, JSON.stringify(rb2.message));
    console.log("[hb-probe] Panel ~30-60sn down olacak, listener bekliyor (geri gelince heartbeat'ler düşecek)...");
  }

  console.log("\n[hb-probe] === SORU 2/3/4: heartbeat bekleniyor (panel HTTP modunda olmalı) ===");
  console.log(`[hb-probe] Her heartbeat'e SIRAYLA Shape 1→2→3 komut gömülecek. Hangisi sonuç POST'u tetiklerse o kabul ediliyor.`);

  const server = startListener();

  const cleanup = async () => {
    console.log("\n[hb-probe] kapanıyor...");
    server.close();
    if (!NO_REVERT) await revertHbProcess();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);

  // Otomatik özet + revert (reboot varsa daha uzun bekle)
  const waitMs = REBOOT ? 150_000 : 100_000;
  setTimeout(async () => {
    console.log(`\n[hb-probe] === ÖZET (${waitMs / 1000}sn) ===`);
    console.log(`  - HB_PROCESS_RESPONSE yazıldı: ${rb.data?.["LOGGER.HB_PROCESS_RESPONSE"] === 1 ? "EVET" : "HAYIR"}`);
    console.log(`  - Heartbeat sayısı: ${hbCount} (${hbCount > 0 ? "geldi" : "GELMEDİ — panel HTTP modunda mı / reboot bitti mi?"})`);
    console.log(`  - Denenen shape sayısı: ${Math.min(hbCount, 3)} / 3`);
    console.log("  - HB_RESPONSE_PATH POST'u yukarıda göründü mü? (göründüyse o shape kabul edildi)");
    console.log("  - Kapı açıldı mı? (manuel gözlem)");
    await cleanup();
  }, waitMs);
};

main();
