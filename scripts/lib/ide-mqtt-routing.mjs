import { mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync, openSync, fsyncSync, closeSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { responseUuid, matchesResponse, boundEvent } from "./ide-mqtt-policy.mjs";

const retryDelay = attempts => Math.min(60_000, 1000 * 2 ** Math.min(Math.max(0, attempts - 1), 6));

/** A bounded, durable FIFO. Persist before HTTP so process restarts also replay lost responses. */
export function createEventSpool({
  directory = process.env.IDE_BRIDGE_SPOOL_DIR || "./ide-bridge-spool",
  convexPost, log = () => {}, now = Date.now, maxEntries = 10_000,
}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "events.jsonl");
  let rows = [];
  let head = 0;
  let draining = false;
  const syncFile = file => {
    const fd = openSync(file, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
  };
  const persist = (nextRows) => {
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, nextRows.map(row => JSON.stringify(row) + "\n").join(""), { mode: 0o600 });
    syncFile(temporary);
    renameSync(temporary, path);
    syncFile(directory);
  };
  const archive = (suffix, contents) => {
    const file = `${path}.${suffix}`;
    appendFileSync(file, contents + "\n", { mode: 0o600 });
    syncFile(file);
    syncFile(directory);
  };
  // A crash before compaction replays acknowledged rows; it never discards an
  // unacknowledged event. The server deduplicates those at-least-once deliveries.
  const compact = () => {
    const remaining = rows.slice(head);
    persist(remaining);
    rows = remaining;
    head = 0;
  };
  let contents = "";
  try { contents = readFileSync(path, "utf8"); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const corrupt = [];
  for (const line of contents.split("\n").filter(Boolean)) {
    try {
      const row = JSON.parse(line);
      if (typeof row?.id !== "string" || typeof row?.body?.topic !== "string" || typeof row?.body?.body !== "string" || !Number.isFinite(row.nextRetryAt) || !Number.isFinite(row.attempts)) {
        throw new Error("Invalid event spool record");
      }
      rows.push(row);
    } catch { corrupt.push(line); }
  }
  if (corrupt.length) {
    archive("corrupt", corrupt.join("\n"));
    persist(rows);
    log(`WARNING: IDE event spool quarantined ${corrupt.length} corrupt record(s) in ${path}.corrupt; inspect the file`);
  } else if (contents && !contents.endsWith("\n")) {
    // Keep a valid last record separate from the next append after an interrupted write.
    persist(rows);
  }
  if (rows.length >= maxEntries) log(`WARNING: IDE event spool limit reached (${rows.length}/${maxEntries})`);
  async function drain() {
    if (draining) return;
    draining = true;
    try {
      for (let count = 0; count < 100; count++) {
        const row = rows[head];
        if (!row || row.nextRetryAt > now()) return;
        const result = await convexPost("/ide-bridge/event", row.body).catch(() => ({ ok: false }));
        const attempts = row.attempts + 1;
        const rejected = !result.ok && result.status >= 400 && result.status < 500 && ![408, 429].includes(result.status);
        if (rejected) archive("rejected", JSON.stringify({ ...row, attempts, status: result.status }));
        if (result.ok || rejected) {
          head++;
          if (head >= 100 || head === rows.length) compact();
        } else {
          rows[head] = { ...row, attempts, nextRetryAt: now() + retryDelay(attempts) };
          compact();
        }
        if (rejected) log(`WARNING: IDE event HTTP ${result.status}; moved to ${path}.rejected; inspect the file`);
        else if (!result.ok) {
          log(`event forward FAIL; retained in spool (${rows.length - head})`);
          return;
        }
      }
    } finally { draining = false; }
  }
  return {
    size: () => rows.length - head,
    drain,
    async forward(body) {
      if (rows.length - head >= maxEntries) {
        log(`WARNING: IDE event spool FULL (${maxEntries}); incoming event rejected`);
        return false;
      }
      const row = { id: randomUUID(), body, attempts: 0, nextRetryAt: now() };
      appendFileSync(path, JSON.stringify(row) + "\n", { mode: 0o600 });
      syncFile(path);
      syncFile(directory);
      rows.push(row);
      await drain();
      return true;
    },
  };
}

/** Retain the correlation entry until Convex confirms the exact same ACK body. */
export async function deliverAck(msxId, body, { pending, convexPost, log = () => {}, now = Date.now }) {
  const entry = pending.get(msxId);
  if (!entry) return;
  if (!entry.ackBody) {
    clearTimeout(entry.timer);
    entry.ackBody = body;
  }
  if (entry.ackInFlight || (entry.ackNextRetryAt ?? 0) > now()) return;
  entry.ackInFlight = true;
  try {
    const response = await convexPost("/ide-bridge/ack", entry.ackBody).catch(() => ({ ok: false }));
    if (response.ok) pending.delete(msxId);
    else {
      entry.ackAttempts = (entry.ackAttempts ?? 0) + 1;
      entry.ackNextRetryAt = now() + retryDelay(entry.ackAttempts);
    }
    log(`ack opId=${entry.opId} result=${entry.ackBody.result} → convex ${response.ok ? "OK" : "FAIL (retained)"}`);
  } finally { entry.ackInFlight = false; }
}

export async function retryPendingAcks(deps) {
  for (const [msxId, entry] of deps.pending) {
    if (entry.ackBody) await deliverAck(msxId, entry.ackBody, deps);
  }
}

export function commandExpired(op, now = Date.now()) {
  return op.opType === "openDoor" && typeof op.expiresAt === "number" && op.expiresAt <= now;
}

// Forward diagnostic meaning without forwarding panel credentials or card identities.
function maskedPanelText(value) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/(bearer\s+)[^\s,;]+/gi, "$1[redacted]")
    .replace(/(["']?(?:password|passwd|pwd|pass|(?:access[_-]?)?token|authorization|card(?:[_ -]?(?:number|no|id))?|user[_ -]?id)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^,;\n}]*)/gi, "$1[redacted]")
    .replace(/\b[A-Za-z0-9_+/=-]{24,}\b/g, "[redacted]")
    .replace(/\d+/g, "[redacted]")
    .replace(/[\r\n\t]+/g, " ");
}

function panelRejection(payload) {
  const rawMessage = typeof payload?.message === "string" ? payload.message : payload?.message?.message;
  const rawCode = payload?.errorCode ?? payload?.error_code ?? payload?.code ?? payload?.message?.code;
  const classify = value => typeof value !== "string" ? undefined
    : /already[ _-]+exists/i.test(value) ? "already_exists"
    : /not[ _-]+found|does ?n'?t exist|no such|not exist/i.test(value) ? "not_found" : undefined;
  const errorCode = classify(rawCode) ?? classify(rawMessage);
  const detail = [maskedPanelText(rawCode), maskedPanelText(rawMessage)].filter(Boolean).join(": ");
  return {
    message: (detail || "panel rejected command").slice(0, 200),
    ...(errorCode ? { errorCode } : {}),
  };
}

/** Incoming bridge boundary. Dependencies are explicit so provenance has offline regressions. */
export async function routeMqttMessage(topic, buf, {
  pending, loginWaiters, tokenCache, convexPost, eventSpool, now = Date.now,
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
      const { opId } = entry;
      // Auth/token hatası → token cache'i temizle ki bir sonraki retry yeniden login yapsın.
      if (result !== "success" && /level|token|forbidden|unauthor/i.test(String(message))) {
        tokenCache.delete(entry.deviceUuid);
        dbg(`token invalidate uuid=${entry.deviceUuid}`);
      }
      const ackBody = {
        opId,
        msxId,
        result: result === "success" ? "success" : "fail",
        ...(result === "success" ? { message: "panel accepted command" } : panelRejection(parsed?.payload)),
      };
      await deliverAck(msxId, ackBody, { pending, convexPost, log, now });
    }
    return;
  }

  const event = boundEvent(topic, parsed, { legacy: legacyEvents });
  if (!event) { dbg("unbound MQTT event dropped"); return; }

  // Event topic normalized only after broker namespace / payload source binding.
  const type = event.topic;
  if (type === "event/heartbeat") dbg(`heartbeat ${parsed?.transaction?.["src-id"]}`);
  else log(`event ${topic} type=${type}`);

  if (eventSpool && type !== "event/heartbeat") {
    await eventSpool.forward({ topic: event.topic, body: raw });
    return;
  }
  const r = await convexPost("/ide-bridge/event", { topic: event.topic, body: raw }).catch((e) => ({ ok: false, text: e.message }));
  if (!r.ok) log(`event forward FAIL topic=${topic}: ${r.status}`);
}
