// Hik Device Gateway event aboneliği → Convex /card-reader köprüsü.
// DS-K1T804AEF gibi httpHosts push desteklemeyen ISUP cihazlarının event'leri yalnız gateway'in
// streaming aboneliğiyle (subscribeDeviceMgmt, multipart uzun-poll) alınabilir; Convex serverless
// bunu tutamaz → bu süreç gateway'in yanında (Hetzner) kalıcı çalışır. Bkz. RUNBOOK.md.
import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const md5 = (value) => createHash('md5').update(value).digest('hex');

export function parseDigestChallenge(header) {
  if (typeof header !== 'string' || !/^Digest\s/i.test(header)) return null;
  const params = {};
  for (const m of header.slice(7).matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g)) {
    params[m[1].toLowerCase()] = m[2] ?? m[3];
  }
  return params.nonce && params.realm ? params : null;
}

export function digestAuthorization({ challenge, username, password, method, uri, cnonce, nc = '00000001' }) {
  const ha1 = md5(`${username}:${challenge.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const qop = challenge.qop?.split(',').map((q) => q.trim()).includes('auth') ? 'auth' : undefined;
  const response = qop
    ? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${challenge.nonce}:${ha2}`);
  const parts = [
    `username="${username}"`, `realm="${challenge.realm}"`, `nonce="${challenge.nonce}"`,
    `uri="${uri}"`, `response="${response}"`,
  ];
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);
  return `Digest ${parts.join(', ')}`;
}

/** Digest auth'lu fetch: önce challenge alır, sonra yetkili isteği atar (gövde iki kez gönderilir). */
export async function digestFetch(url, { username, password, method = 'GET', headers = {}, body, signal }) {
  const first = await fetch(url, { method, headers, body, signal });
  if (first.status !== 401) return first;
  const challenge = parseDigestChallenge(first.headers.get('www-authenticate'));
  if (!challenge) return first;
  await first.body?.cancel();
  const { pathname, search } = new URL(url);
  const authorization = digestAuthorization({
    challenge, username, password, method, uri: pathname + search, cnonce: randomBytes(8).toString('hex'),
  });
  return fetch(url, { method, headers: { ...headers, Authorization: authorization }, body, signal });
}

function findHeaderEnd(buf, from) {
  const crlf = buf.indexOf('\r\n\r\n', from);
  const lf = buf.indexOf('\n\n', from);
  if (crlf >= 0 && (lf < 0 || crlf <= lf)) return { index: crlf, length: 4 };
  if (lf >= 0) return { index: lf, length: 2 };
  return null;
}

/** multipart/mixed akışını parça parça çözer; her parçanın gövdesini (string) onPart'a verir. */
export class MultipartStreamParser {
  constructor(boundary, onPart, maxBuffer = 1024 * 1024) {
    this.delimiter = Buffer.from(`--${boundary}`);
    this.onPart = onPart;
    this.maxBuffer = maxBuffer;
    this.buf = Buffer.alloc(0);
  }

  push(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const start = this.buf.indexOf(this.delimiter);
      if (start < 0) {
        if (this.buf.length > this.maxBuffer) this.buf = Buffer.alloc(0);
        return;
      }
      const headerEnd = findHeaderEnd(this.buf, start + this.delimiter.length);
      if (!headerEnd) return;
      const headers = this.buf.subarray(start + this.delimiter.length, headerEnd.index).toString('latin1');
      const bodyStart = headerEnd.index + headerEnd.length;
      const lengthMatch = /content-length:\s*(\d+)/i.exec(headers);
      let bodyEnd;
      if (lengthMatch) {
        bodyEnd = bodyStart + Number(lengthMatch[1]);
        if (this.buf.length < bodyEnd) return;
      } else {
        bodyEnd = this.buf.indexOf(this.delimiter, bodyStart);
        if (bodyEnd < 0) return;
      }
      const body = this.buf.subarray(bodyStart, bodyEnd).toString('utf8').trim();
      this.buf = this.buf.subarray(bodyEnd);
      if (body) this.onPart(body);
    }
  }
}

/**
 * Gateway event'i Convex'e iletilmeli mi? Yalnız erişim kontrol event'leri; cihazın ISUP alarm
 * kanalı açılınca geri bastığı eski kayıtlar (1970/2024 tarihli, currentEvent:false) yaş filtresiyle
 * düşer. dateTime parse edilemezse iletilir (canlı event'i kaçırmamak için).
 */
export function shouldForward(alert, { now, maxAgeMs }) {
  if (alert?.eventType !== 'AccessControllerEvent' || typeof alert.AccessControllerEvent !== 'object') {
    return { forward: false, reason: 'not_access_event' };
  }
  const time = Date.parse(alert.dateTime);
  if (Number.isFinite(time) && time < now - maxAgeMs) return { forward: false, reason: 'too_old' };
  return { forward: true };
}

/**
 * /card-reader gövdesi. Parser kart event'inde AccessControllerEvent'i payload seçer ve seri no'yu
 * oradan okur; orada yalnız event sıra no'su (serialNo) olduğundan cihaz seri no'su ve ehomeID
 * içeri kopyalanır — yoksa token cihazıyla "device mismatch" (403) olur.
 */
export function toCardReaderBody(alert) {
  return {
    EventNotificationAlert: {
      ...alert,
      AccessControllerEvent: {
        ...alert.AccessControllerEvent,
        deviceSerial: alert.deviceSerial,
        deviceID: alert.deviceID,
      },
    },
  };
}

/**
 * Gateway ISUP event'lerinde cihazın yerel saatini `+00:00` etiketiyle yayınlıyor (cihaz /System/time
 * `+03:00` derken event `19:20:42+00:00` geldi, 2026-10-19). offset verilirse etiket onunla değiştirilir.
 */
export function withTimeOffset(dateTime, offset) {
  if (!offset || typeof dateTime !== 'string') return dateTime;
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(dateTime);
  return m ? `${m[1]}${offset}` : dateTime;
}

export function resolveToken(tokens, alert) {
  return tokens[alert.devIndex] ?? tokens[alert.deviceID] ?? null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createBridge(config, { log = (entry) => console.log(JSON.stringify({ time: new Date().toISOString(), ...entry })) } = {}) {
  const {
    gatewayUrl, username, password, convexSiteUrl, tokens,
    maxAgeMs = 24 * 3600_000, heartbeatTimeoutMs = 30_000, maxQueue = 1000, eventTimeOffset,
  } = config;
  let queue = Promise.resolve();
  let queued = 0;
  let stopped = false;
  let current = null;

  async function post(alert, token) {
    const url = `${convexSiteUrl}/card-reader`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(toCardReaderBody(alert)),
          signal: AbortSignal.timeout(15_000),
        });
        const text = await res.text();
        if (res.ok || res.status < 500) return { status: res.status, body: text.slice(0, 200) };
        log({ event: 'post_retry', attempt, status: res.status });
      } catch (error) {
        log({ event: 'post_retry', attempt, error: String(error) });
      }
      await sleep(attempt * 2000);
    }
    return { status: 0, body: 'failed' };
  }

  function enqueue(rawAlert) {
    const alert = { ...rawAlert, dateTime: withTimeOffset(rawAlert.dateTime, eventTimeOffset) };
    const ace = alert.AccessControllerEvent;
    const decision = shouldForward(alert, { now: Date.now(), maxAgeMs });
    const summary = {
      devIndex: alert.devIndex, deviceID: alert.deviceID, dateTime: alert.dateTime,
      major: ace?.majorEventType, minor: ace?.subEventType, serialNo: ace?.serialNo,
      card: ace?.cardNo ? `…${String(ace.cardNo).slice(-4)}` : undefined,
    };
    if (!decision.forward) {
      if (decision.reason === 'too_old') log({ event: 'skip', reason: decision.reason, ...summary });
      return;
    }
    const token = resolveToken(tokens, alert);
    if (!token) {
      log({ event: 'skip', reason: 'no_token', ...summary });
      return;
    }
    if (queued >= maxQueue) {
      log({ event: 'drop', reason: 'queue_full', ...summary });
      return;
    }
    queued++;
    queue = queue.then(async () => {
      const result = await post(alert, token);
      log({ event: 'forward', ...summary, status: result.status, response: result.body });
    }).finally(() => { queued--; });
  }

  function handlePart(body) {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      log({ event: 'bad_part', body: body.slice(0, 200) });
      return null;
    }
    if (parsed.SubscribeDeviceMgmtRsp) return { subscriptionId: parsed.SubscribeDeviceMgmtRsp.id };
    const alert = parsed.EventNotificationAlert;
    if (alert && alert.eventType !== 'heartBeat') {
      if (alert.eventType === 'devStatusChanged' || alert.eventType === 'addressChange') {
        log({ event: 'device_status', type: alert.eventType, devIndex: alert.devIndex, status: alert.status });
      }
      enqueue(alert);
    }
    return null;
  }

  async function unsubscribe(id) {
    try {
      const res = await digestFetch(`${gatewayUrl}/ISAPI/Event/notification/unSubscribeDeviceMgmt/${id}?format=json`, {
        username, password, method: 'DELETE', signal: AbortSignal.timeout(5000),
      });
      await res.body?.cancel();
    } catch {
      /* best-effort */
    }
  }

  async function subscribeOnce() {
    const controller = new AbortController();
    current = controller;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(new Error('heartbeat_timeout')), heartbeatTimeoutMs);
    };
    let subscriptionId = null;
    try {
      resetTimer();
      const res = await digestFetch(`${gatewayUrl}/ISAPI/Event/notification/subscribeDeviceMgmt?format=json`, {
        username, password, method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ SubscribeDeviceMgmt: { eventMode: 'all', defenceMode: 'all' } }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      const boundary = /boundary=("?)([^";]+)\1/i.exec(contentType)?.[2];
      if (!res.ok || !boundary) {
        const text = await res.text().catch(() => '');
        throw new Error(`subscribe_failed status=${res.status} body=${text.slice(0, 200)}`);
      }
      const parser = new MultipartStreamParser(boundary, (body) => {
        resetTimer();
        const meta = handlePart(body);
        if (meta?.subscriptionId !== undefined) {
          subscriptionId = meta.subscriptionId;
          log({ event: 'subscribed', subscriptionId });
        }
      });
      for await (const chunk of res.body) parser.push(chunk);
      throw new Error('stream_ended');
    } finally {
      clearTimeout(timer);
      current = null;
      if (subscriptionId !== null) await unsubscribe(subscriptionId);
    }
  }

  async function run() {
    let backoff = 1000;
    while (!stopped) {
      const startedAt = Date.now();
      try {
        await subscribeOnce();
      } catch (error) {
        if (stopped) break;
        log({ event: 'stream_closed', reason: String(error?.cause ?? error?.message ?? error) });
      }
      if (Date.now() - startedAt > 60_000) backoff = 1000;
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 30_000);
    }
    await queue;
  }

  function stop() {
    stopped = true;
    current?.abort(new Error('shutdown'));
  }

  return { run, stop, handlePart, enqueue, drain: () => queue };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const required = ['HIK_GATEWAY_PASS', 'CONVEX_SITE_URL', 'HIK_DEVICE_TOKENS'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Eksik env: ${missing.join(', ')}`);
    process.exit(1);
  }
  let tokens;
  try {
    tokens = JSON.parse(process.env.HIK_DEVICE_TOKENS);
  } catch {
    console.error('HIK_DEVICE_TOKENS geçerli JSON değil ({"<devIndex|ehomeID>":"<apiToken>"})');
    process.exit(1);
  }
  const bridge = createBridge({
    gatewayUrl: process.env.HIK_GATEWAY_URL ?? 'http://127.0.0.1:8088',
    username: process.env.HIK_GATEWAY_USER ?? 'admin',
    password: process.env.HIK_GATEWAY_PASS,
    convexSiteUrl: process.env.CONVEX_SITE_URL.replace(/\/$/, ''),
    tokens,
    maxAgeMs: (Number(process.env.MAX_EVENT_AGE_HOURS) || 24) * 3600_000,
    heartbeatTimeoutMs: Number(process.env.HEARTBEAT_TIMEOUT_MS) || 30_000,
    eventTimeOffset: process.env.EVENT_TIME_OFFSET || undefined,
  });
  console.log(JSON.stringify({ time: new Date().toISOString(), event: 'start', devices: Object.keys(tokens).length }));
  const shutdown = () => bridge.stop();
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  bridge.run().then(() => process.exit(0));
}
