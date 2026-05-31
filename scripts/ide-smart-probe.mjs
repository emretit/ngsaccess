#!/usr/bin/env node
/**
 * IDE Smart panel bağlantı probe'u — gerçek cihazla envelope/login akışını doğrular.
 * Convex'e DOKUNMAZ; sadece panele HTTP/JSON gönderir. Aynı LAN'dan çalıştır.
 *
 * Kullanım:
 *   IDE_IP=192.168.1.50 IDE_PASS=admin node scripts/ide-smart-probe.mjs
 *   IDE_IP=192.168.1.50 IDE_PORT=80 IDE_USER=admin IDE_PASS=*** node scripts/ide-smart-probe.mjs
 *
 * Opsiyonel:
 *   IDE_OPEN_IO=0   → login sonrası io_id 0 kapısını pulse açmayı dener
 *   IDE_UUID=...    → dst-id olarak gönderilir (genelde gerekmez, login dst-id muaf)
 *
 * Çıktı: her adımın ham request/response'u + sonuç özeti.
 */

const IP = process.env.IDE_IP;
const PORT = Number(process.env.IDE_PORT || 80);
const USER = process.env.IDE_USER || "admin";
const PASS = process.env.IDE_PASS;
const UUID = process.env.IDE_UUID; // opsiyonel dst-id
const OPEN_IO = process.env.IDE_OPEN_IO; // opsiyonel: "0".."7"

if (!IP || !PASS) {
  console.error("HATA: IDE_IP ve IDE_PASS zorunlu.\nÖrnek: IDE_IP=192.168.1.50 IDE_PASS=admin node scripts/ide-smart-probe.mjs");
  process.exit(1);
}

const SRC_ID = 1001;
let msx = 1;
const url = `http://${IP}:${PORT}/`;

function envelope(type, payload, { token, dstId } = {}) {
  const transaction = { "msx-id": msx++, "src-id": SRC_ID, type };
  // dst-id NUMBER olmalı (firmware string'i sessizce reddeder).
  if (dstId !== undefined && dstId !== null) {
    transaction["dst-id"] = /^\d+$/.test(String(dstId)) ? Number(dstId) : dstId;
  }
  if (token) transaction.token = token;
  return JSON.stringify({ transaction, payload });
}

async function post(label, body) {
  console.log(`\n── ${label} ──`);
  // Login request'inde şifreyi maskele — log'a düz metin parola yazma.
  const shown = body.replace(/("password":")[^"]*(")/, "$1***$2");
  console.log("→ REQ:", shown);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: ctrl.signal,
    });
    const raw = await res.text();
    console.log(`← HTTP ${res.status}`);
    console.log("← RES:", raw.slice(0, 1500));
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { /* ham bırak */ }
    return { status: res.status, raw, payload: parsed?.payload ?? null };
  } catch (e) {
    console.log("✖ İSTEK HATASI:", e.message);
    return { status: 0, raw: "", payload: null, error: e };
  } finally {
    clearTimeout(t);
  }
}

(async () => {
  console.log(`IDE Smart probe → ${url}  (user=${USER})`);

  // 1) LOGIN
  const login = await post(
    "1) login",
    envelope("login", { user: USER, password: PASS }, { dstId: UUID }),
  );
  const token = login.payload?.result === "success" ? login.payload?.data?.token : null;
  if (!token) {
    console.log("\n✖ Login başarısız — token alınamadı. Yukarıdaki RES'e bak (şifre/seviye/erişim).");
    process.exit(2);
  }
  console.log("\n✓ Token alındı:", String(token).slice(0, 24) + "…");

  // dst-id ZORUNLU (login hariç). Verilmediyse token'dan türet: level.iat.exp.UUID.sig
  const tokenUuid = String(token).split(".")[3];
  const dstId = UUID ?? tokenUuid;
  console.log("  dst-id (panel UUID):", dstId);

  // 2) parameter_read — panel kimliği + kapı/aktüatör bilgisi
  await post(
    "2) parameter_read (SYSTEM + AC)",
    envelope(
      "parameter_read",
      { parameters: ["SYSTEM.UUID", "SYSTEM.DEVICE_NAME", "AC.MAX_PERMS_PER_USER", "NTP.TIME"] },
      { token, dstId },
    ),
  );

  // 3) opsiyonel: kapı aç (io_id pulse)
  if (OPEN_IO !== undefined && OPEN_IO !== "") {
    await post(
      `3) update_actuator (io_id=${OPEN_IO} pulse)`,
      envelope("update_actuator", { io_id: Number(OPEN_IO), value: 1 }, { token, dstId }),
    );
  } else {
    console.log("\n(ℹ kapı açma testi atlandı — denemek için IDE_OPEN_IO=0 ekle)");
  }

  console.log("\n✓ Probe tamamlandı.");
})();
