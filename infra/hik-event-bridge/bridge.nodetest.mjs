import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBridge, MultipartStreamParser, digestAuthorization, parseDigestChallenge, resolveToken, shouldForward, toCardReaderBody, withTimeOffset,
} from './bridge.mjs';
import { parseCardReaderBody } from '../../convex/lib/cardReaderParse.ts';

// Canlı yakalandı 2026-10-19 (DS-K1T804AEF FW V1.4.0, gateway V1.8.0.4 subscribeDeviceMgmt).
const cardAlert = {
  AccessControllerEvent: {
    PurePwdVerifyEnable: true, RetransFlag: 0, attendanceStatus: 'undefined', cardNo: '0008463106', cardReaderNo: 1,
    cardType: 1, currentEvent: false, doorNo: 1, frontSerialNo: 265, majorEventType: 5, serialNo: 266, subEventType: 9,
  },
  activePostCount: 1, channelID: '1', channelName: 'Channel 1', dateTime: '2026-10-19T18:12:13+00:00',
  devIndex: 'D12D7DAE-9272-394E-9EF2-3807CEC0AA3A', deviceID: 'NGS0001', deviceSerial: 'FK5305278',
  eventDescription: 'Access Controller Event', eventState: 'active', eventType: 'AccessControllerEvent',
};

function part(json) {
  const body = Buffer.from(JSON.stringify(json));
  return Buffer.concat([
    Buffer.from(`--boundary\r\nContent-Type: application/json; charset="UTF-8"\r\nContent-Length: ${body.length}\r\n\r\n`),
    body,
    Buffer.from('\r\n'),
  ]);
}

test('multipart parser parçaları chunk sınırlarından bağımsız çözer', () => {
  const stream = Buffer.concat([
    part({ SubscribeDeviceMgmtRsp: { id: 1 } }),
    part({ EventNotificationAlert: { eventType: 'heartBeat' } }),
    part({ EventNotificationAlert: { ...cardAlert, channelName: 'Kapı ğüşİ' } }),
  ]);
  for (const size of [1, 7, 64, stream.length]) {
    const parts = [];
    const parser = new MultipartStreamParser('boundary', (body) => parts.push(JSON.parse(body)));
    for (let i = 0; i < stream.length; i += size) parser.push(stream.subarray(i, i + size));
    assert.equal(parts.length, 3, `chunk=${size}`);
    assert.equal(parts[0].SubscribeDeviceMgmtRsp.id, 1);
    assert.equal(parts[2].EventNotificationAlert.channelName, 'Kapı ğüşİ');
  }
});

test('Content-Length yoksa bir sonraki boundary’ye kadar okur', () => {
  const parts = [];
  const parser = new MultipartStreamParser('b', (body) => parts.push(body));
  parser.push(Buffer.from('--b\r\nContent-Type: application/json\r\n\r\n{"a":1}\r\n--b\r\nContent-Type: application/json\r\n\r\n'));
  assert.deepEqual(parts, ['{"a":1}']);
});

test('digest yanıtı RFC 2617 örneğiyle eşleşir', () => {
  const challenge = parseDigestChallenge('Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"');
  const header = digestAuthorization({
    challenge, username: 'Mufasa', password: 'Circle Of Life', method: 'GET', uri: '/dir/index.html', cnonce: '0a4f113b',
  });
  assert.match(header, /response="6629fae49393a05397450978507c4ef1"/);
  assert.match(header, /opaque="5ccc069c403ebaf9f0171e9517f40e41"/);
});

test('yaş filtresi eski geri-basılan kayıtları düşürür, canlıyı iletir', () => {
  const now = Date.parse('2026-10-19T15:40:00Z');
  const maxAgeMs = 24 * 3600_000;
  assert.deepEqual(shouldForward(cardAlert, { now, maxAgeMs }), { forward: true });
  assert.equal(shouldForward({ ...cardAlert, dateTime: '1970-01-01T00:00:11+00:00' }, { now, maxAgeMs }).reason, 'too_old');
  assert.equal(shouldForward({ eventType: 'devStatusChanged' }, { now, maxAgeMs }).reason, 'not_access_event');
  assert.equal(shouldForward({ ...cardAlert, dateTime: 'bozuk' }, { now, maxAgeMs }).forward, true);
});

test('gateway’in +00:00 etiketi yapılandırılan offset ile değiştirilir', () => {
  assert.equal(withTimeOffset('2026-10-19T19:20:42+00:00', '+03:00'), '2026-10-19T19:20:42+03:00');
  assert.equal(withTimeOffset('2026-10-19T19:20:42Z', '+03:00'), '2026-10-19T19:20:42+03:00');
  assert.equal(withTimeOffset('2026-10-19T19:20:42', '+03:00'), '2026-10-19T19:20:42+03:00');
  assert.equal(withTimeOffset('2026-10-19T19:20:42+00:00', undefined), '2026-10-19T19:20:42+00:00');
  assert.equal(withTimeOffset('bozuk', '+03:00'), 'bozuk');
});

test('token devIndex, yoksa ehomeID ile çözülür', () => {
  assert.equal(resolveToken({ 'D12D7DAE-9272-394E-9EF2-3807CEC0AA3A': 't1' }, cardAlert), 't1');
  assert.equal(resolveToken({ NGS0001: 't2' }, cardAlert), 't2');
  assert.equal(resolveToken({}, cardAlert), null);
});

test('köprü gövdesi /card-reader parser’ında cihaz seri no + kart no verir', () => {
  const parsed = parseCardReaderBody(JSON.stringify(toCardReaderBody(cardAlert)), 'application/json');
  assert.equal(parsed.user_id, '0008463106');
  assert.equal(parsed.serial, 'FK5305278');
  assert.equal(parsed.hikDevIndex, 'D12D7DAE-9272-394E-9EF2-3807CEC0AA3A');
  assert.equal(parsed.hikEhomeID, 'NGS0001');
  assert.equal(parsed.hikMajorEventType, 5);
  assert.equal(parsed.hikSubEventType, 9);
  assert.equal(parsed.hikSerialNo, 266);
  assert.equal(parsed.hikFrontSerialNo, 265);
});

test('ham gateway gövdesinde parser seri no yerine event sıra no okur (köprü dönüşümünün gerekçesi)', () => {
  const parsed = parseCardReaderBody(JSON.stringify({ EventNotificationAlert: cardAlert }), 'application/json');
  assert.equal(parsed.serial, '266');
});

test('kartsız erişim event’i cihaz seri no ile ayrıştırılır', () => {
  const doorEvent = {
    ...cardAlert,
    AccessControllerEvent: { currentEvent: true, doorNo: 1, frontSerialNo: 1, majorEventType: 5, serialNo: 2, subEventType: 27 },
  };
  const parsed = parseCardReaderBody(JSON.stringify(toCardReaderBody(doorEvent)), 'application/json');
  assert.equal(parsed.user_id, undefined);
  assert.equal(parsed.serial, 'FK5305278');
  assert.equal(parsed.hikMajorEventType, 5);
  assert.equal(parsed.hikSubEventType, 27);
});

const config = {
  gatewayUrl: 'http://gateway', username: 'admin', password: 'test-password',
  convexSiteUrl: 'https://example.convex.site', tokens: { 'dev-1': 'token-1' },
};
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

test('devStatusChanged doğru URL, Bearer, zaman ve gövdeyle mevcut kuyruktan gönderilir', async (t) => {
  const calls = [];
  const logs = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options });
    return new Response(null, { status: 200 });
  });
  const receivedAt = Date.parse('2026-10-22T12:00:00Z');
  t.mock.method(Date, 'now', () => receivedAt);
  const bridge = createBridge({ ...config, eventTimeOffset: '+03:00' }, { log: entry => logs.push(entry) });
  bridge.handlePart(JSON.stringify({ EventNotificationAlert: { eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'offline', dateTime: '2026-10-22T12:00:00Z' } }));
  await bridge.drain();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.convex.site/hik-gateway/device-status');
  assert.equal(calls[0].headers.Authorization, 'Bearer token-1');
  assert.deepEqual(JSON.parse(calls[0].body), { devIndex: 'dev-1', status: 'offline', at: Date.parse('2026-10-22T12:00:00Z') });
  assert.equal(logs.find(entry => entry.event === 'forward').status, 200);
  bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'online' });
  await bridge.drain();
  assert.equal(JSON.parse(calls[1].body).at, receivedAt);
  for (const skew of [-3, 3]) {
    bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'offline', dateTime: new Date(receivedAt + skew * 3600_000).toISOString() });
  }
  await bridge.drain();
  assert.deepEqual(calls.slice(2).map(call => JSON.parse(call.body).at), [receivedAt, receivedAt]);
});

test('addressChange/heartBeat ve geçersiz durum yok sayılır; eksik token skip olur', async (t) => {
  const calls = [];
  const logs = [];
  t.mock.method(globalThis, 'fetch', async (...args) => { calls.push(args); return new Response(); });
  const bridge = createBridge(config, { log: entry => logs.push(entry) });
  for (const eventType of ['heartBeat', 'addressChange']) bridge.handlePart(JSON.stringify({ EventNotificationAlert: { eventType, devIndex: 'dev-1', status: 'online' } }));
  bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'unknown', status: 'offline' });
  bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'invalid' });
  await bridge.drain();
  assert.equal(calls.length, 0);
  assert.deepEqual(logs, [{ event: 'skip', reason: 'no_token', type: 'devStatusChanged', devIndex: 'unknown', deviceStatus: 'offline', source: undefined }]);
});

test('durum ve kart olayları aynı maxQueue sınırını kullanır ve kişi verisi loglanmaz', async (t) => {
  const calls = [];
  const logs = [];
  t.mock.method(globalThis, 'fetch', async (...args) => { calls.push(args); return new Response(); });
  const bridge = createBridge({ ...config, maxQueue: 1, tokens: { ...config.tokens, [cardAlert.devIndex]: 'card-token' } }, { log: entry => logs.push(entry) });
  bridge.enqueue({ ...cardAlert, dateTime: new Date().toISOString() });
  bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'offline' });
  await bridge.drain();
  assert.equal(calls.length, 1);
  assert.equal(logs.find(entry => entry.event === 'drop').reason, 'queue_full');
  assert.equal(logs.some(entry => 'card' in entry || 'response' in entry), false);
});

test('snapshot yalnız token sahibi cihazları gönderir; eksik/bozuk liste offline sayılmaz', async (t) => {
  const posts = [];
  let malformed = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.includes('/deviceList')) return Response.json(malformed ? {} : { SearchResult: { MatchList: [
      { Device: { devIndex: 'dev-1', devStatus: 'online' } },
      { Device: { devIndex: 'unknown', devStatus: 'offline' } },
      { Device: { devIndex: 'dev-2', devStatus: 'offline', EhomeParams: { EhomeID: 'panel-2' } } },
    ] } });
    posts.push({ url, ...options });
    return new Response();
  });
  const logs = [];
  const bridge = createBridge({ ...config, tokens: { ...config.tokens, 'panel-2': 'token-2' } }, { log: entry => logs.push(entry) });
  await bridge.snapshot(); await bridge.drain();
  assert.equal(posts.length, 2);
  assert.equal(posts[1].headers.Authorization, 'Bearer token-2');
  assert.deepEqual(posts.map(post => JSON.parse(post.body).source), ['snapshot', 'snapshot']);
  assert.deepEqual(posts.map(post => JSON.parse(post.body).status), ['online', 'offline']);
  malformed = true;
  await bridge.snapshot(); await bridge.drain();
  assert.equal(posts.length, 2);
  assert.equal(logs.at(-1).event, 'snapshot_failed');
});

test('abonelik snapshotları 5 dk içinde atlanır; saatlik timer ve daha geç yeniden abonelik çalışır', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: Date.parse('2026-10-22T12:00:00Z') });
  let streamController;
  let subscriptions = 0;
  let snapshots = 0;
  const posts = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.includes('/subscribeDeviceMgmt?')) {
      subscriptions++;
      const stream = new ReadableStream({ start(controller) {
        streamController = controller;
        controller.enqueue(part({ SubscribeDeviceMgmtRsp: { id: subscriptions } }));
        options.signal.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true });
      } });
      return new Response(stream, { headers: { 'Content-Type': 'multipart/mixed; boundary=boundary' } });
    }
    if (url.includes('/deviceList')) {
      snapshots++;
      return Response.json({ SearchResult: { MatchList: [{ Device: { devIndex: 'dev-1', devStatus: 'online' } }] } });
    }
    if (url.includes('/unSubscribeDeviceMgmt/')) return new Response();
    posts.push(JSON.parse(options.body));
    return new Response();
  });
  const bridge = createBridge({ ...config, heartbeatTimeoutMs: 2 * 3600_000 }, { log: () => {} });
  const running = bridge.run();
  await flush(); await bridge.drain();
  assert.equal(snapshots, 1);
  t.mock.timers.tick(3600_000);
  await flush(); await bridge.drain();
  assert.equal(snapshots, 2);
  assert.equal(posts.length, 2);
  assert.ok(posts.every(post => post.source === 'snapshot'));
  streamController.close();
  await flush();
  t.mock.timers.tick(1000);
  await flush(); await bridge.drain();
  assert.equal(subscriptions, 2);
  assert.equal(snapshots, 2);
  t.mock.timers.tick(5 * 60_000);
  streamController.close();
  await flush();
  t.mock.timers.tick(1000);
  await flush(); await bridge.drain();
  assert.equal(subscriptions, 3);
  assert.equal(snapshots, 3);
  bridge.stop();
  await running;
  t.mock.timers.tick(3600_000);
  await flush();
  assert.equal(snapshots, 3);
});

test('durum gönderimi 5xx sonrası aynı gövdeyle yeniden denenir', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options });
    return new Response(null, { status: calls.length === 1 ? 503 : 200 });
  });
  const bridge = createBridge(config, { log: () => {} });
  bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'offline' });
  await flush();
  t.mock.timers.tick(2000);
  await bridge.drain();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body, calls[1].body);
});


test('snapshot sayacı kuyruk dolu düşmeleri saymaz', async (t) => {
  const logs = [];
  const posts = [];
  let releasePost;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.includes('/deviceList')) return Response.json({ SearchResult: { MatchList: [
      { Device: { devIndex: 'dev-1', devStatus: 'online' } },
      { Device: { devIndex: 'dev-2', devStatus: 'offline' } },
    ] } });
    posts.push(JSON.parse(options.body));
    await new Promise(resolve => { releasePost = resolve; });
    return new Response();
  });
  const bridge = createBridge({ ...config, maxQueue: 1, tokens: { ...config.tokens, 'dev-2': 'token-2' } }, { log: entry => logs.push(entry) });
  await bridge.snapshot();
  assert.equal(logs.find(entry => entry.event === 'snapshot').devices, 1);
  assert.equal(logs.filter(entry => entry.reason === 'queue_full').length, 1);
  releasePost();
  await bridge.drain();
  assert.equal(posts.length, 1);
});
