import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const bridgePattern = /^[A-Za-z0-9_-]{1,64}$/;
const windowMs = 60_000;

function matchesHex(actual, expected) {
  if (typeof actual !== 'string' || !/^[a-f0-9]{64}$/.test(actual)) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024) {
        chunks.length = 0;
        // Gövdeyi okumayı bırak; 413 'Connection: close' ile gider, soket kapanır.
        req.removeAllListeners('data');
        req.pause();
        reject(new Error('too_large'));
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
    req.on('aborted', () => reject(new Error('aborted')));
  });
}

export function createRelayServer({ secret, now = Date.now, pingMs = 25_000 }) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('HIK_RELAY_SECRET en az 32 karakter olmalı');
  }
  const bridges = new Map();
  const wakes = new Map();
  const hmac = (value) => createHmac('sha256', secret).update(value).digest('hex');
  const log = (event, bridgeId, result) => console.log(JSON.stringify({
    time: new Date(now()).toISOString(), event, bridgeId, result,
  }));
  const prune = (times) => times.filter((ts) => ts > now() - windowMs);
  const sweep = setInterval(() => {
    for (const [bridgeId, times] of wakes) {
      const recent = prune(times);
      if (recent.length) wakes.set(bridgeId, recent);
      else wakes.delete(bridgeId);
    }
  }, windowMs);
  sweep.unref();

  const server = createServer(async (req, res) => {
    let bridgeId = null;
    const reply = (status, body, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
      res.end(JSON.stringify(body));
      log('request', bridgeId, status);
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const method = new Map([
        ['/hik-bridge/stream', 'GET'],
        ['/hik-bridge/wake', 'POST'],
        ['/hik-bridge/health', 'GET'],
      ]).get(url.pathname);
      if (!method) return reply(404, { ok: false, error: 'not_found' });
      if (req.method !== method) return reply(405, { ok: false, error: 'method_not_allowed' }, { Allow: method });

      if (url.pathname === '/hik-bridge/health') {
        let connections = 0;
        for (const clients of bridges.values()) connections += clients.size;
        return reply(200, { ok: true, bridges: bridges.size, connections });
      }

      if (url.pathname === '/hik-bridge/stream') {
        const candidate = url.searchParams.get('bridge');
        if (!bridgePattern.test(candidate ?? '') || !matchesHex(url.searchParams.get('ticket'), hmac(`stream.${candidate}`))) {
          return reply(401, { ok: false, error: 'unauthorized' });
        }
        bridgeId = candidate;
        let clients = bridges.get(bridgeId);
        if (!clients) {
          clients = new Set();
          bridges.set(bridgeId, clients);
        }
        if (clients.size >= 3) {
          const oldest = clients.values().next().value;
          clients.delete(oldest);
          oldest.end();
        }
        clients.add(res);
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        });
        res.write(`retry: 10000\n\nevent: ready\ndata: ${JSON.stringify({ bridgeId })}\n\n`);
        const ping = setInterval(() => {
          if (!res.write(': ping\n\n')) res.destroy();
        }, pingMs);
        ping.unref();
        res.on('close', () => {
          clearInterval(ping);
          clients.delete(res);
          if (!clients.size && bridges.get(bridgeId) === clients) bridges.delete(bridgeId);
          log('disconnect', bridgeId, 'closed');
        });
        log('stream', bridgeId, 200);
        return;
      }

      const raw = await readBody(req);
      const ts = req.headers['x-ngs-ts'];
      const timestamp = typeof ts === 'string' && /^\d+$/.test(ts) ? Number(ts) : NaN;
      if (!Number.isSafeInteger(timestamp) || Math.abs(now() - timestamp) > windowMs ||
          !matchesHex(req.headers['x-ngs-signature'], hmac(Buffer.concat([Buffer.from(`${ts}.`), raw])))) {
        return reply(401, { ok: false, error: 'unauthorized' });
      }
      let body;
      try { body = JSON.parse(raw.toString('utf8')); }
      catch { return reply(400, { ok: false, error: 'invalid_body' }); }
      if (!body || typeof body.bridgeId !== 'string' || !bridgePattern.test(body.bridgeId)) {
        return reply(400, { ok: false, error: 'invalid_bridge' });
      }
      bridgeId = body.bridgeId;
      const recent = prune(wakes.get(bridgeId) ?? []);
      if (recent.length >= 30) return reply(429, { ok: false, error: 'rate_limited' });
      recent.push(now());
      wakes.set(bridgeId, recent);
      let delivered = 0;
      for (const client of bridges.get(bridgeId) ?? []) {
        if (client.destroyed || client.writableEnded) continue;
        const writable = client.write(`event: wake\ndata: ${JSON.stringify({ ts: now() })}\n\n`);
        delivered++;
        // write(false) veriyi kabul eder; yavaş istemcide sınırsız tampon biriktirme.
        if (!writable) client.destroy();
      }
      return reply(200, { ok: true, delivered });
    } catch (error) {
      if (res.destroyed) return;
      const tooLarge = error instanceof Error && error.message === 'too_large';
      reply(tooLarge ? 413 : 400,
        { ok: false, error: tooLarge ? 'payload_too_large' : 'invalid_request' },
        tooLarge ? { Connection: 'close' } : {});
    }
  });
  server.on('close', () => clearInterval(sweep));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const secret = process.env.HIK_RELAY_SECRET;
  if (!secret || secret.length < 32) {
    console.error('HIK_RELAY_SECRET zorunlu ve en az 32 karakter olmalı');
    process.exit(1);
  }
  const server = createRelayServer({ secret });
  const port = Number(process.env.PORT ?? 8791);
  const host = process.env.HOST ?? '127.0.0.1';
  server.listen(port, host, () => console.log(JSON.stringify({ time: new Date().toISOString(), event: 'listen', bridgeId: null, result: 'ready' })));
  const shutdown = () => {
    console.log(JSON.stringify({ time: new Date().toISOString(), event: 'shutdown', bridgeId: null, result: 'closing' }));
    server.close(() => process.exit(0));
    server.closeAllConnections();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
