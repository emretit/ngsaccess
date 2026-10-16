import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { request } from 'node:http';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { createRelayServer } from './server.mjs';

const secret = randomBytes(32).toString('hex');
const bridge = 'bridge_test-1';
const sign = (value) => createHmac('sha256', secret).update(value).digest('hex');

async function fixture(t, options = {}) {
  let time = 1_800_000_000_000;
  const server = createRelayServer({ secret, now: () => time, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return {
    base,
    advance: (ms) => { time += ms; },
    wake: (overrides = {}) => {
      const body = overrides.body ?? JSON.stringify({ bridgeId: bridge });
      const ts = overrides.ts ?? String(time);
      return fetch(`${base}/hik-bridge/wake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ngs-Ts': ts,
          'X-Ngs-Signature': overrides.signature ?? sign(`${ts}.${body}`),
        },
        body,
      });
    },
  };
}

async function stream(t, base, id = bridge) {
  const req = request(`${base}/hik-bridge/stream?bridge=${id}&ticket=${sign(`stream.${id}`)}`, {
    headers: { Accept: 'text/event-stream' },
  });
  req.end();
  const [res] = await once(req, 'response');
  let data = '';
  const waiters = new Set();
  res.on('data', (chunk) => {
    data += chunk.toString();
    for (const waiter of waiters) waiter();
  });
  t.after(() => req.destroy());
  return {
    res,
    closed: new Promise((resolve) => res.once('end', resolve)),
    waitFor: (text) => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { waiters.delete(check); reject(new Error(`SSE bekleniyor: ${text}`)); }, 2000);
      const check = () => {
        if (data.includes(text)) { clearTimeout(timeout); waiters.delete(check); resolve(data); }
      };
      waiters.add(check);
      check();
    }),
  };
}

test('secret zorunlu ve en az 32 karakter', () => {
  assert.throws(() => createRelayServer({ secret: '' }));
  assert.throws(() => createRelayServer({ secret: 'a'.repeat(31) }));
});

test('CLI eksik/kısa secret ile stderr ve exit 1 üretir', () => {
  for (const value of ['', 'short']) {
    const result = spawnSync(process.execPath, ['infra/hik-relay/server.mjs'], {
      env: { ...process.env, HIK_RELAY_SECRET: value }, encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /HIK_RELAY_SECRET/);
    assert.equal(result.stdout, '');
  }
});

test('CLI SIGTERM ve SIGINT ile kapanır ve secret loglamaz', { timeout: 5000 }, async (t) => {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    const child = spawn(process.execPath, ['infra/hik-relay/server.mjs'], {
      env: { ...process.env, HIK_RELAY_SECRET: secret, HOST: '127.0.0.1', PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    await once(child.stdout, 'data');
    const exited = once(child, 'exit');
    child.kill(signal);
    assert.deepEqual(await exited, [0, null]);
    assert.ok(output.includes('"event":"shutdown"'));
    assert.ok(!output.includes(secret));
  }
});

test('yanlış, kısa ve büyük harfli bilet ile geçersiz bridge 401', async (t) => {
  const { base } = await fixture(t);
  for (const [id, ticket] of [[bridge, '0'.repeat(64)], [bridge, 'x'], [bridge, sign(`stream.${bridge}`).toUpperCase()], ['bad.id', sign('stream.bad.id')], ['', sign('stream.')]]) {
    const res = await fetch(`${base}/hik-bridge/stream?bridge=${id}&ticket=${ticket}`);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { ok: false, error: 'unauthorized' });
  }
});

test('SSE ready, retry, ping ve imzalı wake iki bağlantıya gider', async (t) => {
  const { base, wake } = await fixture(t, { pingMs: 20 });
  const first = await stream(t, base);
  const second = await stream(t, base);
  assert.equal(first.res.statusCode, 200);
  assert.equal(first.res.headers['content-type'], 'text/event-stream');
  assert.equal(first.res.headers['cache-control'], 'no-cache');
  assert.equal(first.res.headers['x-accel-buffering'], 'no');
  const ready = await first.waitFor('event: ready\n');
  assert.ok(ready.startsWith('retry: 10000\n\n'));
  assert.ok(ready.includes(`data: {"bridgeId":"${bridge}"}\n\n`));
  await first.waitFor(': ping\n\n');
  const result = await wake();
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true, delivered: 2 });
  for (const client of [first, second]) {
    assert.ok((await client.waitFor('event: wake\n')).includes('data: {"ts":1800000000000}\n\n'));
  }
});

test('eski, gelecek ve sayısal olmayan ts ile bozuk imza 401', async (t) => {
  const { wake } = await fixture(t);
  for (const overrides of [{ ts: '1799999939999' }, { ts: '1800000060001' }, { ts: 'NaN' }, { ts: '1.8e12' }, { signature: 'f'.repeat(64) }, { signature: 'short' }]) {
    const res = await wake(overrides);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { ok: false, error: 'unauthorized' });
  }
});

test('ts ±60 saniye sınırında geçerli ve bağlı istemci yoksa delivered 0', async (t) => {
  const { wake } = await fixture(t);
  for (const ts of ['1799999940000', '1800000060000']) {
    const res = await wake({ ts });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, delivered: 0 });
  }
});

test('31. wake 429, kayan pencere dolar ve bridge sınırları ayrıdır', async (t) => {
  const { wake, advance } = await fixture(t);
  for (let i = 0; i < 30; i++) assert.equal((await wake()).status, 200);
  assert.equal((await wake()).status, 429);
  assert.equal((await wake({ body: JSON.stringify({ bridgeId: 'other' }) })).status, 200);
  advance(59_999);
  assert.equal((await wake()).status, 429);
  advance(1);
  assert.equal((await wake()).status, 200);
});

test('4. bağlantı en eskiyi kapatır, health bridge ve bağlantıları sayar', async (t) => {
  const { base, wake } = await fixture(t);
  const health = async () => (await fetch(`${base}/hik-bridge/health`)).json();
  assert.deepEqual(await health(), { ok: true, bridges: 0, connections: 0 });
  const first = await stream(t, base);
  await first.waitFor('event: ready');
  for (let i = 0; i < 3; i++) await (await stream(t, base)).waitFor('event: ready');
  await first.closed;
  assert.deepEqual(await health(), { ok: true, bridges: 1, connections: 3 });
  assert.deepEqual(await (await wake()).json(), { ok: true, delivered: 3 });
  const other = await stream(t, base, 'other');
  await other.waitFor('event: ready');
  assert.deepEqual(await health(), { ok: true, bridges: 2, connections: 4 });
  other.res.destroy();
  // Sunucunun close olayını işlemesini health üzerinden gözle.
  for (let i = 0; i < 20; i++) {
    if ((await health()).bridges === 1) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('Kapanan bridge temizlenmedi');
});

test('1 KB üstü gövde 413, imzalı geçersiz JSON/bridge 400', async (t) => {
  const { wake } = await fixture(t);
  assert.equal((await wake({ body: 'x'.repeat(1025) })).status, 413);
  for (const body of ['{', 'null', '{}', '{"bridgeId":"bad.id"}']) assert.equal((await wake({ body })).status, 400);
  const body = JSON.stringify({ bridgeId: bridge }).padEnd(1024);
  assert.equal((await wake({ body })).status, 200);
});

test('imza ham JSON baytlarını kapsar', async (t) => {
  const { wake } = await fixture(t);
  assert.equal((await wake({ body: `{ "bridgeId": "${bridge}" }`, signature: sign(`1800000000000.${JSON.stringify({ bridgeId: bridge })}`) })).status, 401);
});

test('bilinmeyen yol 404, yanlış method 405 ve Allow başlığı', async (t) => {
  const { base } = await fixture(t);
  for (const path of ['/unknown', '/constructor']) assert.equal((await fetch(`${base}${path}`)).status, 404);
  for (const [path, method, allowed] of [['health', 'POST', 'GET'], ['stream', 'POST', 'GET'], ['wake', 'GET', 'POST']]) {
    const res = await fetch(`${base}/hik-bridge/${path}`, { method });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), allowed);
  }
});
